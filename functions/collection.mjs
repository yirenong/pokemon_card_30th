import pg from 'pg';
import {attachDatabasePool} from '@neon/functions';
import storeModule from '../server/collection-store.cjs';
import handlerModule from '../server/collection-handler.cjs';

const pool = new pg.Pool({connectionString:process.env.DATABASE_URL,max:3,connectionTimeoutMillis:10000,idleTimeoutMillis:5000});
attachDatabasePool(pool);
const handler = handlerModule.createHandler(()=>new storeModule.CollectionStore(pool));

// This is intentionally one public shared checklist, as requested. No database
// credentials are exposed. The same validation runs here and on the Vercel API.
export default {
  async fetch(request) {
    if (new URL(request.url).pathname !== '/') return new Response('Not found',{status:404});
    const headers = Object.fromEntries(request.headers);
    headers.host = new URL(request.url).host;
    let body;
    if (request.method === 'PATCH') {
      const raw = await request.text();
      if (Buffer.byteLength(raw)>32768) return Response.json({error:'PAYLOAD_TOO_LARGE'},{status:413});
      try {body=JSON.parse(raw)} catch {return Response.json({error:'INVALID_CHANGES'},{status:400})}
    }
    const responseHeaders = {};
    let status = 200, result;
    await handler({method:request.method,headers,body},{
      setHeader(name,value){responseHeaders[name]=value},
      status(code){status=code;return this},
      json(value){result=value}
    });
    return Response.json(result,{status,headers:responseHeaders});
  }
};
