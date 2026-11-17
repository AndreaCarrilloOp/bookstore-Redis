'use strict';
const { randomInt } = require('node:crypto');
const { configOf } = require('./config');
const { reply, preflight, badMethod, parseBody, idFromEvent, errorReply } = require('./http');
const { normalizeDocument } = require('./validation');
const { openDatabase, withDatabase } = require('./mongoDB');
const { enqueue, withRedis } = require('./redis');
const { drain } = require('./consumer');

function functionHandler(name, work) {
  return async (event, context) => {
    if (context) context.callbackWaitsForEmptyEventLoop = false;
    try { return await work(event); }
    catch (error) { return errorReply(error, name); }
  };
}
function readHandler(entity, one = false) {
  return functionHandler(`${entity}${one ? 'Find' : 'FindAll'}`, async event => {
    const early = preflight(event) || badMethod(event, 'GET');
    if (early) return early;
    const id = one ? idFromEvent(event) : undefined;
    const rows = await withDatabase(database => {
      const collection = database.collection(configOf(entity).collection);
      return one ? collection.find({ _id: id }).toArray() : collection.find({}).sort({ _id: 1 }).toArray();
    });
    return reply(200, rows);
  });
}
function enqueueHandler(entity, method) {
  const verb = { INSERT: 'POST', UPDATE: 'PUT', DELETE: 'DELETE' }[method];
  const name = `${entity}:${method}`;
  return functionHandler(name, async event => {
    const early = preflight(event) || badMethod(event, verb);
    if (early) return early;
    const id = method === 'INSERT' ? Date.now() * 1000 + randomInt(0, 1000) : idFromEvent(event);
    const request = { method, id };
    if (method !== 'DELETE') request.body = normalizeDocument(entity, parseBody(event), { update: method === 'UPDATE' });
    console.info(`[${name}] enviando a Redis`);
    const queue = await enqueue(entity, request);
    console.info(`[${name}] Redis confirmó RPUSH; id=${id}`);
    return reply(202, { queued: true, queue, operation: method, id, message: 'Solicitud encolada; aún no aplicada en MongoDB' });
  });
}
function batchHandler(entity, method) {
  return functionHandler(`${entity}:${method}:batch`, async event => preflight(event) || reply(403, { error: 'Endpoint de lote solo para uso interno de *Tasks' }));
}
function tasksHandler(entity, batchHandlers) {
  const queue = configOf(entity).queue;
  return functionHandler(`${entity}Tasks`, async event => {
    const early = preflight(event) || badMethod(event, 'GET');
    if (early) return early;
    const token = process.env.TASKS_TOKEN;
    if (token && (event.headers?.['x-tasks-token'] || event.headers?.['X-Tasks-Token']) !== token)
      return reply(401, { error: 'Procesamiento protegido: se requiere autorización' });
    const limit = Math.max(1, Math.min(50, Math.floor(Number(process.env.TASKS_BATCH_SIZE) || 5)));
    // Una conexión MongoDB por lote, abierta solo cuando hay una operación aplicable.
    const report = await withRedis(async client => {
      let connection;
      const handlers = Object.fromEntries(Object.entries(batchHandlers).map(([method, apply]) =>
        [method, async request => {
          if (!connection) connection = await openDatabase();
          return apply(request, connection.database);
        }]));
      try { return await drain({ entity, queue, client, limit, handlers }); }
      finally { if (connection) await connection.close(); }
    });
    return reply(report.busy ? 409 : report.errors.length ? 502 : 200, report);
  });
}
module.exports = { readHandler, enqueueHandler, batchHandler, tasksHandler };
