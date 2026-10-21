(function(root) {
  const OUTBOX_KEY = 'thirty-backend-outbox-v1' + (root.ThirtyLoginId ? ':' + root.ThirtyLoginId : '');
  function create(options) {
    const ids = new Set(options.ids);
    const storage = options.storage;
    const fetcher = options.fetch || root.fetch.bind(root);
    const initial = {};
    for (const [id,value] of Object.entries(options.initial || {})) if (ids.has(id) && (value === true || Number.isInteger(value) && value > 0)) initial[id] = true;
    const pending = new Map();
    let remote = null, busy = false, timer = null, sequence = 0, storageAvailable = true;
    const state = {owned:{...initial}, status:'loading', pending:0, error:null, lastSynced:null, localPersisted:true};
    try {
      const saved = JSON.parse(storage?.getItem(OUTBOX_KEY) || '{}');
      for (const [id,value] of Object.entries(saved || {})) if (ids.has(id) && typeof value?.owned === 'boolean') pending.set(id,{owned:value.owned,token:++sequence});
    } catch {storageAvailable=false}
    function storePending() {
      try {
        if (!storage) throw Error();
        storage.setItem(OUTBOX_KEY,JSON.stringify(Object.fromEntries(pending)));
        storageAvailable = true;
      } catch {storageAvailable=false}
    }
    function emit() {
      state.owned = {...(remote ? remote.owned : initial)};
      for (const [id,value] of pending) state.owned[id] = value.owned;
      state.pending = pending.size;
      state.localPersisted = storageAvailable;
      options.onChange?.(state);
    }
    function snapshot(data) {
      if (!data || typeof data.initialized !== 'boolean' || !Number.isSafeInteger(data.revision) || data.revision < 0 || !data.owned || Array.isArray(data.owned) || typeof data.owned !== 'object' || !Number.isFinite(Date.parse(data.updatedAt))) throw Error('Invalid storage response');
      const owned = {};
      for (const [id,value] of Object.entries(data.owned)) {
        if (!ids.has(id)) continue;
        if (typeof value !== 'boolean') throw Error('Invalid ownership data');
        owned[id] = value;
      }
      return {...data,owned};
    }
    async function request(body, keepalive = false) {
      const response = await fetcher('/api/collection',{
        method:body ? 'PATCH' : 'GET',
        headers:{...(body ? {'Content-Type':'application/json'} : {'Accept':'application/json'}),...(root.ThirtyLoginId ? {'X-Login-Id':root.ThirtyLoginId} : {})},
        body:body ? JSON.stringify(body) : undefined,
        cache:'no-store', credentials:'same-origin', keepalive,
        signal:root.AbortSignal?.timeout?.(20000)
      });
      if (!response.ok) {
        let code = 'STORAGE_UNAVAILABLE';
        try {code=(await response.json()).error || code} catch {}
        const error = new Error(code);
        error.code = code;
        throw error;
      }
      return snapshot(await response.json());
    }
    async function synchronize(keepalive = false) {
      if (busy) return;
      if (timer) {root.clearTimeout(timer);timer=null}
      busy = true;
      state.status = pending.size ? 'saving' : remote ? 'checking' : 'loading';
      state.error = null;
      emit();
      try {
        if (!remote || !pending.size) remote = await request();
        if (!remote.initialized) {
          remote = await request({action:'initialize',changes:Object.keys(initial).map(id=>({id,owned:true}))},keepalive);
        }
        emit();
        while (pending.size) {
          const batch = [...pending].map(([id,value])=>({id,...value}));
          remote = await request({action:'update',changes:batch.map(({id,owned})=>({id,owned}))},keepalive);
          for (const change of batch) if (pending.get(change.id)?.token === change.token) pending.delete(change.id);
          storePending();
          emit();
        }
        state.status='saved';
        state.lastSynced=new Date().toISOString();
      } catch (error) {
        state.error=error.code || 'STORAGE_UNAVAILABLE';
        state.status=['STORAGE_NOT_CONFIGURED','SCHEMA_NOT_READY'].includes(state.error) ? 'unconfigured' : 'offline';
      } finally {busy=false;emit()}
    }
    function setMany(changes) {
      let changed=false;
      for (const {id,owned} of changes) {
        if (!ids.has(id) || typeof owned !== 'boolean') continue;
        pending.set(id,{owned,token:++sequence});
        changed=true;
      }
      if (!changed) return;
      storePending();
      state.status='queued';
      emit();
      if (timer) root.clearTimeout(timer);
      timer=root.setTimeout(()=>synchronize(),180);
    }
    function setOwned(id,owned) {setMany([{id,owned}])}
    return {state, setOwned, setMany, start:synchronize, refresh:synchronize, flush:()=>synchronize(true),dispose:()=>{if(timer) root.clearTimeout(timer)}};
  }
  const exported={create,OUTBOX_KEY};
  if (typeof module !== 'undefined' && module.exports) module.exports=exported;
  else root.ThirtyCollectionSync=exported;
})(typeof window !== 'undefined' ? window : globalThis);
