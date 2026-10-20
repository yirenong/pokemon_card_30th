const fs=require('fs');const {Client}=require('pg');
async function migrate(connectionString) {
  if (!connectionString) throw Error('DATABASE_URL_UNPOOLED is required');
  if (new URL(connectionString).hostname.includes('-pooler')) throw Error('Use the direct connection for migrations');
  const client=new Client({connectionString,connectionTimeoutMillis:10000});
  try {
    await client.connect();
    await client.query('BEGIN');
    const sql=fs.readFileSync(require('path').join(__dirname,'../db/migrations/001_collection.sql'),'utf8').replace(/^\uFEFF/,'');
    await client.query(sql);
    await client.query('COMMIT');
    console.log('Collection schema ready.');
  } catch(error) {await client.query('ROLLBACK').catch(()=>{});throw error} finally {await client.end()}
}
if(require.main===module)migrate(process.env.DATABASE_URL_UNPOOLED).catch(error=>{console.error('Migration failed:',error.code || 'DATABASE_ERROR');process.exit(1)});
module.exports={migrate};
