const http=require('http'),fs=require('fs'),path=require('path');
const handler=require('../api/collection.js');
const dist=path.resolve(__dirname,'../dist');
function createServer(api=handler) {
  return http.createServer(async(req,res)=>{
    res.status=code=>{res.statusCode=code;return res};
    res.json=data=>{res.setHeader('Content-Type','application/json');res.end(JSON.stringify(data))};
    if(req.url.split('?')[0]==='/api/collection') {
      const chunks=[];let size=0;
      for await(const chunk of req) {size+=chunk.length;if(size>32768){res.status(413).json({error:'PAYLOAD_TOO_LARGE'});return}chunks.push(chunk)}
      if(chunks.length){try{req.body=JSON.parse(Buffer.concat(chunks).toString('utf8'))}catch{res.status(400).json({error:'INVALID_JSON'});return}}
      return api(req,res);
    }
    try {
      const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
      const filename=path.resolve(dist,'.'+(pathname==='/'?'/index.html':pathname));
      if(!filename.startsWith(dist+path.sep)){res.statusCode=403;return res.end()}
      const data=await fs.promises.readFile(filename);
      const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.jpg':'image/jpeg','.png':'image/png','.pdf':'application/pdf'};
      res.setHeader('Content-Type',types[path.extname(filename)]||'application/octet-stream');res.setHeader('Cache-Control','no-store');res.end(data);
    } catch {res.statusCode=404;res.end('Not found')}
  });
}
if(require.main===module){const port=Number(process.env.PORT)||4173;createServer().listen(port,'127.0.0.1',()=>console.log('Collection tracker: http://127.0.0.1:'+port))}
module.exports={createServer};
