'use strict';
const { validateRequest } = require('./validation');
const { randomUUID } = require('node:crypto');
const LOCK = 'bookstore:tasks:lock';
// El bloqueo impide que dos invocaciones Tasks procesen simultáneamente la lista compartida.
// No se extrae un mensaje hasta que la escritura batch finalice. Si falla, queda pendiente.
async function drain({ entity, queue, client, handlers, limit = 20 }) {
  const report = { queue, entity, processed: 0, remaining: false, errors: [] };
  const token = randomUUID();
  const locked = await client.set(LOCK, token, { NX: true, EX: 120 });
  if (locked !== 'OK') return { ...report, busy: true, errors: ['Ya hay otro procesamiento activo'] };
  try {
    const messages = await client.lRange(queue, 0, -1);
    let matching = 0;
    for (const raw of messages) {
      let msg;
      try { msg = JSON.parse(raw); }
      catch (error) { report.errors.push('Mensaje JSON inválido en bookstore; se conserva para revisión'); break; }
      if (!msg || !['book','author','publisher'].includes(msg.entity)) {
        report.errors.push('Mensaje sin entidad válida en bookstore; se conserva para revisión'); break;
      }
      if (msg.entity !== entity) continue;
      matching++;
      if (report.processed >= limit) { report.remaining = true; break; }
      try {
        const request = validateRequest(entity, msg);
        await handlers[request.method](request);
        // Remover exactamente UNA ocurrencia del mensaje procesado.
        await client.lRem(queue, 1, raw);
        report.processed++;
      } catch (error) { console.error('[tasks]', entity, error.code || error.name);
        report.errors.push('No se pudo aplicar una operación; permanece pendiente para revisión'); break; }
    }
    return report;
  } finally {
    await client.eval('if redis.call("GET", KEYS[1]) == ARGV[1] then return redis.call("DEL", KEYS[1]) else return 0 end', {
      keys: [LOCK], arguments: [token]
    });
  }
}
module.exports = { drain };
