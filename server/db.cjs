const {Pool} = require('pg');
const {attachDatabasePool} = require('@vercel/functions');
let pool;
function getPool() {
  if (!process.env.DATABASE_URL) {
    const error = new Error('Set DATABASE_URL in the Vercel project environment.');
    error.code = 'STORAGE_NOT_CONFIGURED';
    throw error;
  }
  if (!pool) {
    pool = new Pool({connectionString:process.env.DATABASE_URL, max:3, connectionTimeoutMillis:10000, idleTimeoutMillis:5000});
    pool.on('error', error => console.error('Idle database connection error', error.code || 'DATABASE_ERROR'));
    attachDatabasePool(pool);
  }
  return pool;
}
module.exports = {getPool};
