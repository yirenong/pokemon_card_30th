const cards = require('../dist/cards.json');
const {getPool} = require('./db.cjs');
const {CollectionStore} = require('./collection-store.cjs');
const {RemoteCollectionStore} = require('./remote-store.cjs');
const ids = new Set(cards.map(card=>card.id));
function validateBody(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body) || !['update','initialize'].includes(body.action)) throw Error('Invalid action');
  if (!Array.isArray(body.changes) || body.changes.length > ids.size) throw Error('Invalid changes');
  if (body.action === 'update' && !body.changes.length) throw Error('No changes supplied');
  const seen = new Set();
  const changes = body.changes.map(change=>{
    if (!change || !ids.has(change.id) || typeof change.owned !== 'boolean' || seen.has(change.id)) throw Error('Invalid card or ownership value');
    seen.add(change.id);
    return {id:change.id,owned:change.owned};
  });
  return {changes, initialize:body.action === 'initialize'};
}
function createHandler(storeFactory = loginId => process.env.DATABASE_URL ? new CollectionStore(getPool(),loginId) : new RemoteCollectionStore(undefined,undefined,loginId)) {
  return async function handler(req,res) {
    res.setHeader('Cache-Control','no-store, max-age=0');
    res.setHeader('X-Content-Type-Options','nosniff');
    res.setHeader('Vary','X-Login-Id');
    if (!['GET','PATCH','POST'].includes(req.method)) {
      res.setHeader('Allow','GET, PATCH, POST');
      return res.status(405).json({error:'METHOD_NOT_ALLOWED'});
    }
    const loginId = req.headers['x-login-id'];
    if (loginId !== undefined && (typeof loginId !== 'string' || !/^[a-z0-9][a-z0-9_-]{2,23}$/.test(loginId))) return res.status(401).json({error:'INVALID_LOGIN_ID'});
    let data;
    if (req.method === 'PATCH' || req.method === 'POST') {
      // No login is required, but unrelated browser origins cannot submit writes.
      const origin = req.headers.origin;
      const host = req.headers.host;
      try {if (origin && new URL(origin).host !== host) return res.status(403).json({error:'ORIGIN_NOT_ALLOWED'})} catch {return res.status(403).json({error:'ORIGIN_NOT_ALLOWED'})}
      if (!(req.headers['content-type'] || '').toLowerCase().startsWith('application/json')) return res.status(415).json({error:'JSON_REQUIRED'});
      try {
        const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
        if (Buffer.byteLength(JSON.stringify(body) || '') > 32768) return res.status(413).json({error:'PAYLOAD_TOO_LARGE'});
        if (req.method === 'POST') {
          if (!loginId || body?.action !== 'register') return res.status(400).json({error:'INVALID_REGISTRATION'});
        } else data = validateBody(body);
      } catch {return res.status(400).json({error:'INVALID_CHANGES'})}
    }
    try {
      const store = storeFactory(loginId);
      const snapshot = req.method === 'POST' ? await store.register() : req.method === 'GET' ? await store.read() : await store.update(data.changes,data.initialize);
      return res.status(req.method === 'POST' ? 201 : 200).json({...snapshot,...(loginId?{loginId}:{})});
    } catch (error) {
      if (error.code === 'LOGIN_EXISTS') return res.status(409).json({error:'LOGIN_EXISTS'});
      if (error.code === 'LOGIN_NOT_FOUND') return res.status(404).json({error:'LOGIN_NOT_FOUND'});
      const code = error.code === 'STORAGE_NOT_CONFIGURED' ? 'STORAGE_NOT_CONFIGURED' : ['SCHEMA_NOT_READY','42P01'].includes(error.code) ? 'SCHEMA_NOT_READY' : 'STORAGE_UNAVAILABLE';
      console.error('Collection storage request failed',code);
      return res.status(503).json({error:code});
    }
  };
}
module.exports = {createHandler,validateBody};
