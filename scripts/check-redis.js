'use strict';
require('dotenv').config();
const { withRedis } = require('../netlify/lib/redis');
withRedis(async client => {
  console.log('Redis:', await client.ping());
  console.log('Tipo bookstore:', await client.type('bookstore'));
  console.log('Pendientes:', await client.lLen('bookstore'));
}, 6000).catch(error => { console.error('Prueba Redis fallida:', error.code || error.name); process.exitCode = 1; });
