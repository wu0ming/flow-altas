import './build.mjs';
import http from 'node:http';
const {default:worker}=await import('../dist/server/index.js');
const objects=new Map();
const BUCKET={get:async k=>objects.get(k),put:async(k,body,opts)=>{const old=objects.get(k);if(old?old.etag!==opts.onlyIf.etagMatches:opts.onlyIf.etagMatches)return null;const value={etag:crypto.randomUUID(),json:async()=>JSON.parse(body)};objects.set(k,value);return value}};
const port=Number(process.env.PORT||process.argv[process.argv.indexOf('--port')+1])||5173;
http.createServer(async(q,r)=>{if(q.url==='/__mobile-check'){r.setHeader('content-type','text/html');r.end('<title>移动端布局检查</title><iframe title="390px 手机页面" style="width:390px;height:790px;border:0" src="/"></iframe>');return}const buf=[];for await(const b of q)buf.push(b);const host=q.headers.host;
const req=new Request('http://'+host+q.url,{method:q.method,headers:{...q.headers,'oai-authenticated-user-id':'preview',...(q.headers.origin?{origin:'http://'+host}:{})},body:buf.length?Buffer.concat(buf):undefined});
const result=await worker.fetch(req,{BUCKET});r.writeHead(result.status,Object.fromEntries(result.headers));r.end(Buffer.from(await result.arrayBuffer()))}).listen(port,'0.0.0.0');
