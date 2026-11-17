'use strict';
const { batchHandler } = require('../lib/handlers');
const { applyBatch } = require('../lib/batch');
// La función publisherTasks invoca esta operación luego de extraer un mensaje de Redis.
exports.apply = (request, database) => applyBatch('publisher', request, database);
// Se bloquea la llamada HTTP directa: preserva el flujo diferido.
exports.handler = batchHandler('publisher', 'INSERT');
