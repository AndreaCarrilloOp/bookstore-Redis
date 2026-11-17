'use strict';
const { createClient } = require('redis');
const { configOf } = require('./config');

function deadline(promise, ms, label) {
  let timer;
  return Promise.race([promise, new Promise((_, reject) => {
    timer = setTimeout(() => reject(Object.assign(new Error(label), { code: 'REDIS_TIMEOUT' })), ms);
  })]).finally(() => clearTimeout(timer));
}
async function closeRedis(client) {
  if (client?.isOpen) {
    try { await client.disconnect(); } catch (_) { /* ya cerrado */ }
  }
}
// Una conexión por invocación. Sin reintentos infinitos ni sockets abiertos al retornar.
async function redis() {
  const host = process.env.REDIS_HOST;
  const port = Number(process.env.REDIS_PORT);
  if (!host || !Number.isInteger(port) || port < 1 || port > 65535 || !process.env.REDIS_PASSWORD)
    throw Object.assign(new Error('Configure REDIS_HOST, REDIS_PORT y REDIS_PASSWORD'), { code: 'REDIS_CONFIG' });
  const tls = String(process.env.REDIS_TLS || 'false').trim().toLowerCase() === 'true';
  const client = createClient({ username: process.env.REDIS_USERNAME || 'default',
    password: process.env.REDIS_PASSWORD, disableOfflineQueue: true,
    socket: { host, port, tls, connectTimeout: 4000, reconnectStrategy: false } });
  // No imprimir URIs, contraseñas o datos de los mensajes.
  client.on('error', error => console.error('[redis] socket:', error.code || error.name));
  try {
    await deadline(client.connect(), 4000, 'Redis no confirmó la conexión a tiempo');
    return client;
  } catch (error) { await closeRedis(client); throw error; }
}
async function withRedis(work, timeoutMs) {
  const client = await redis();
  try {
    const pending = Promise.resolve().then(() => work(client));
    return timeoutMs ? await deadline(pending, timeoutMs, 'Redis no confirmó la operación a tiempo; verifique la lista antes de reintentar') : await pending;
  } finally { await closeRedis(client); }
}
async function enqueue(entity, request) {
  const queue = configOf(entity).queue;
  const message = JSON.stringify({ entity, ...request });
  await withRedis(client => client.rPush(queue, message), 4000);
  return queue;
}
module.exports = { redis, withRedis, enqueue };
