'use strict';
const { MongoClient } = require('mongodb');
async function openDatabase() {
  if (!process.env.MONGODB_URI) throw Object.assign(new Error('Configure MONGODB_URI'), { code: 'MONGO_CONFIG' });
  const client = new MongoClient(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 9000, connectTimeoutMS: 7000 });
  try {
    await client.connect();
    return { database: client.db(process.env.MONGODB_DB || 'bookstore'), close: () => client.close() };
  } catch (error) { await client.close().catch(() => {}); throw error; }
}
async function withDatabase(work) {
  const connection = await openDatabase();
  try { return await work(connection.database); }
  finally { await connection.close(); }
}
module.exports = { openDatabase, withDatabase };
