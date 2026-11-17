'use strict';
const { reply, preflight, badMethod, errorReply } = require('../lib/http');
const { withRedis } = require('../lib/redis');
// Diagnóstico de solo lectura desde el entorno de Netlify; no devuelve credenciales.
exports.handler = async (event, context) => {
  if (context) context.callbackWaitsForEmptyEventLoop = false;
  const early = preflight(event) || badMethod(event, 'GET');
  if (early) return early;
  try {
    const health = await withRedis(async client => {
      const answer = await client.ping();
      const type = await client.type('bookstore');
      const pending = type === 'none' ? 0 : type === 'list' ? await client.lLen('bookstore') : null;
      return { redis: answer, queue: 'bookstore', type, pending };
    }, 4000);
    return reply(health.type === 'none' || health.type === 'list' ? 200 : 409, health);
  } catch (error) { return errorReply(error, 'redisHealth'); }
};
