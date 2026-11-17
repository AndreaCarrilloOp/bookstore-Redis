'use strict';
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'content-type,x-tasks-token',
  'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
  'Content-Type': 'application/json; charset=utf-8'
};
function reply(statusCode, payload) {
  return { statusCode, headers: CORS, body: JSON.stringify(payload) };
}
function preflight(event) {
  return event.httpMethod === 'OPTIONS' ? reply(200, { ok: true }) : null;
}
function badMethod(event, method) {
  return event.httpMethod !== method ? reply(405, { error: `Se requiere ${method}` }) : null;
}
function parseBody(event) {
  if (!event.body) throw new Error('Falta el cuerpo JSON');
  let obj;
  try { obj = JSON.parse(event.isBase64Encoded ? Buffer.from(event.body, 'base64').toString('utf8') : event.body); }
  catch (_) { throw new Error('Cuerpo JSON inválido'); }
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) throw new Error('El cuerpo debe ser un objeto JSON');
  return obj;
}
function numericId(raw) {
  const n = Number(raw);
  if (!Number.isSafeInteger(n) || n <= 0) throw new Error('Se requiere un identificador entero positivo');
  return n;
}
function idFromEvent(event) {
  const parts = (event.path || '').split('/').filter(Boolean);
  return numericId(parts.at(-1));
}
function errorReply(error, phase = 'backend') {
  const message = String(error?.message || 'Error desconocido');
  const expected = !error?.code && /Cuerpo JSON|objeto JSON|identificador|Falta el cuerpo|Campo|No se permiten/i.test(message);
  if (expected) return reply(400, { error: message });
  const rawCode = String(error?.code || error?.name || 'ERROR');
  const code = /^[A-Za-z0-9_]+$/.test(rawCode) ? rawCode : 'ERROR';
  const detail = /WRONGPASS|NOAUTH|authentication failed/i.test(message) ? 'Autenticación rechazada' :
    /NOPERM/i.test(message) ? 'Permisos insuficientes' :
    /WRONGTYPE/i.test(message) ? 'La clave bookstore no es una lista' :
    /TLS|SSL|certificate/i.test(message) ? 'Revise la configuración TLS del servicio' :
    /REDIS_CONFIG|MONGO_CONFIG/.test(code) ? 'Revise las variables privadas del backend' :
    /REDIS_TIMEOUT|ETIMEDOUT/.test(code) ? 'Tiempo de espera agotado; verifique Redis antes de reintentar' :
    'Revise la conexión y los registros de Netlify';
  console.error(`[backend] ${phase}: ${code}; ${detail}`);
  return reply(code === 'REDIS_TIMEOUT' ? 503 : 502, { error: `${phase}: ${detail} (${code})`, code });
}
module.exports = { reply, preflight, badMethod, parseBody, numericId, idFromEvent, errorReply };
