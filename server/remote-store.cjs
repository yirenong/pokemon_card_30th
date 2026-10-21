// Public service URL only; database credentials stay inside Neon.
const PRODUCTION_URL = 'https://br-lucky-lab-a1edg7sz-collection.compute.c-1.ap-southeast-1.aws.neon.tech/';
class RemoteCollectionStore {
  constructor(url=PRODUCTION_URL,fetchImpl=fetch,loginId){this.url=url;this.fetch=fetchImpl;this.loginId=loginId}
  async request(body) {
    const response=await this.fetch(this.url,{
      method:body?'PATCH':'GET',
      headers:{...(body?{'Content-Type':'application/json'}:{}),...(this.loginId?{'X-Login-Id':this.loginId}:{})},
      body:body?JSON.stringify(body):undefined,
      signal:AbortSignal.timeout(20000),redirect:'error',cache:'no-store'
    });
    if(!response.ok) throw Object.assign(new Error('Collection service unavailable'),{code:'STORAGE_UNAVAILABLE'});
    const data=await response.json();
    if(this.loginId && data.loginId!==this.loginId) throw Error('Login service not ready');
    if(typeof data.initialized!=='boolean'||!Number.isSafeInteger(data.revision)||!data.owned||typeof data.owned!=='object') throw Error('Invalid collection response');
    return data;
  }
  read(){return this.request()}
  update(changes,initialize=false){return this.request({action:initialize?'initialize':'update',changes})}
}
module.exports={RemoteCollectionStore};
