const fs=require('fs');const {Client}=require('pg');
async function migrate(connectionString) {
  if (!connectionString) throw Error('DATABASE_URL_UNPOOLED is required');
  if (new URL(connectionString).hostname.includes('-pooler')) throw Error('Use the direct connection for migrations');
  const client=new Client({connectionString,connectionTimeoutMillis:10000});
  try {
    await client.connect();
    await client.query('BEGIN');
    const directory=require('path').join(__dirname,'../db/migrations');
    for (const file of fs.readdirSync(directory).filter(f=>f.endsWith('.sql')).sort()) await client.query(fs.readFileSync(require('path').join(directory,file),'utf8').replace(/^\uFEFF/,''));
    await client.query('COMMIT');
    console.log('Collection schema ready.');
  } catch(error) {await client.query('ROLLBACK').catch(()=>{});throw error} finally {await client.end()}
}
if(require.main===module)migrate(process.env.DATABASE_URL_UNPOOLED).catch(error=>{console.error('Migration failed:',error.code || 'DATABASE_ERROR');process.exit(1)});
module.exports={migrate};
