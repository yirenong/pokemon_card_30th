const assert=require('node:assert/strict');
const {RemoteCollectionStore}=require('./server/remote-store.cjs');
const Sync=require('./dist/collection-sync.js');
const url=process.env.COLLECTION_TEST_FUNCTION_URL;
if(!url||!url.includes('br-withered-voice-a1czqdex-')) throw Error('Use the isolated test Function URL');
const storage=()=>{const entries={};return{getItem:k=>entries[k]||null,setItem:(k,v)=>{entries[k]=v}}};
(async()=>{
  const store=new RemoteCollectionStore(url);
  const before=await store.read();
  const clients=[];
  try {
    const fetchApi=async(path,options)=>fetch(url,options);
    const one=Sync.create({ids:['30c-1','30c-2'],storage:storage(),fetch:fetchApi});clients.push(one);
    await one.start();one.setOwned('30c-1',true);await one.refresh();assert.equal(one.state.pending,0);assert.equal(one.state.status,'saved');
    const two=Sync.create({ids:['30c-1','30c-2'],storage:storage(),fetch:fetchApi});clients.push(two);
    await two.start();assert.equal(two.state.owned['30c-1'],true);
    two.setOwned('30c-1',false);two.setOwned('30c-2',true);await two.refresh();
    await one.refresh();assert.equal(one.state.owned['30c-1'],false);assert.equal(one.state.owned['30c-2'],true);
    const invalid=await fetch(url,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'update',changes:[{id:'bad-id',owned:true}]})});assert.equal(invalid.status,400);
    console.log('PASS: deployed Function persists checks and unchecks across independent browser clients; rejects invalid cards');
  }finally{clients.forEach(c=>c.dispose());await store.update(['30c-1','30c-2'].map(id=>({id,owned:before.owned[id]===true})))}
})().catch(e=>{console.error(e);process.exitCode=1});
