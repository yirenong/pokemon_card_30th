const {spawnSync}=require('child_process');const fs=require('fs');
if(!fs.existsSync('.env.test.local')){console.error('Create .env.test.local for an isolated database branch before running integration tests.');process.exit(1)}
for(const file of ['verify-db.cjs','verify-db-ui.cjs']){const result=spawnSync(process.execPath,['--env-file=.env.test.local',file],{stdio:'inherit',env:{...process.env,COLLECTION_TEST_MODE:'1'}});if(result.status!==0)process.exit(result.status||1)}
