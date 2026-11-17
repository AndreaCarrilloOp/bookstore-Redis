'use strict';
const { batchHandler } = require('../lib/handlers');
const { applyBatch } = require('../lib/batch');
// La función bookTasks invoca esta operación luego de extraer un mensaje de Redis.
exports.apply = (request, database) => applyBatch('book', request, database);
// Se bloquea la llamada HTTP directa: preserva el flujo diferido.
exports.handler = batchHandler('book', 'DELETE');
