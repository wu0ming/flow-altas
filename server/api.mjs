const scopes=['通用','工作','生活'], states=['已使用','测试中','规划中','待核实'];
const collections=['nodes','edges','groups'];
const string=(maxLength)=>({type:'string',minLength:1,maxLength});
const id={...string(80),pattern:'^[a-zA-Z0-9_-]+$'};
const enumOf=(values)=>({type:'string',enum:values});
const fields={
 nodes:{id,name:string(60),type:string(30),scope:enumOf(scopes),note:{type:'string',maxLength:1500},icon:string(25)},
 edges:{id,from:id,to:id,fromDomain:{type:'string',maxLength:80},toDomain:{type:'string',maxLength:80},label:string(120),channelType:{type:'string',maxLength:40},channelName:{type:'string',maxLength:120},group:id,scope:enumOf(scopes),status:enumOf(states),both:{type:'boolean'}},
 groups:{id,name:string(60),short:string(30),icon:string(25)}
};
const invalid=(message,status=400)=>{throw Object.assign(new Error(message),{status})};
function validate(value,schema,key) {
 if(typeof value!==schema.type || (schema.enum&&!schema.enum.includes(value)) || (schema.minLength&&!value.trim()) || (schema.maxLength&&value.length>schema.maxLength) || (schema.pattern&&!new RegExp(schema.pattern).test(value)))invalid('字段无效 · '+key);
}
export const toolsList=[{name:'read_atlas',description:'读取当前图谱、流程及版本。修改前先读取。',inputSchema:{type:'object',properties:{}}},...collections.map(collection=>({
 name:'save_'+collection,description:'新增或更新一条记录。传入完整记录及读取到的 revision。保留原有 ID，未经确认的关系使用待核实。',inputSchema:{type:'object',properties:{revision:{type:'integer'},record:{type:'object',properties:fields[collection],required:Object.keys(fields[collection]).filter(k=>!['channelType','channelName','fromDomain','toDomain'].includes(k)),additionalProperties:false}},required:['revision','record']}
})),{name:'delete_record',description:'删除指定记录；删除节点会移除关联连线。先向用户说明影响。',inputSchema:{type:'object',properties:{revision:{type:'integer'},collection:enumOf(collections),id},required:['revision','collection','id']}}];
export async function readAtlas(bucket,key){
 const obj=await bucket.get(key);
 const {undo,...data}=obj?await obj.json():structuredClone(seed);
 for(const e of data.edges){
  e.fromDomain??='';e.toDomain??='';
  e.channelType??='';e.channelName??='';
 }
 return {data,etag:obj?.etag,undo};
}
function saveRecord(data,collection,record,createOnly=false){
 if(!record||typeof record!=='object')invalid('缺少记录');
 const list=data[collection],at=list.findIndex(x=>x.id===record.id),clean={};
 if(createOnly&&at>=0)invalid('该记录已经存在，请刷新图谱',409);
 const old=collection==='edges'&&list[at]?.from===record.from&&list[at]?.to===record.to?list[at]:null;
 const optional=['channelType','channelName','fromDomain','toDomain'];
 for(const [key,schema] of Object.entries(fields[collection])){
  const value=record[key]===undefined&&optional.includes(key)?old?.[key]||'':record[key];
  validate(value,schema,key);clean[key]=typeof value==='string'?value.trim():value;
 }
 if(collection==='edges'){
  if([clean.fromDomain,clean.toDomain].some(id=>id&&!data.groups.some(g=>g.id===id)))invalid('所选端点处理域不存在');
  if(clean.from===clean.to||![clean.from,clean.to].every(n=>data.nodes.some(x=>x.id===n))||!data.groups.some(x=>x.id===clean.group))invalid('连线需指定两个不同的现有节点和一个流程');
 }
 if(at>=0)list[at]=clean;
 else{
  if(list.length>=1500)invalid('当前集合已达上限');
  list.push(clean);
 }
}
function saveConnections(data,records,pivot,outward=true){
 if(!Array.isArray(records)||records.length>1500)invalid('请选择有效的目标节点');
 const seen=new Set(),start=outward?'from':'to',end=outward?'to':'from';
 for(const record of records){
  if(!record||record[start]!==pivot||seen.has(record[end]))invalid('批量连线需要一个选定节点和多个不同的已有节点');
  seen.add(record[end]);saveRecord(data,'edges',record,true);
 }
}
export async function apply(bucket,key,op){
 if(!op||!collections.includes(op.collection))invalid('未知操作');
 const {data,etag,undo}=await readAtlas(bucket,key);
 if(op.revision!==data.revision)invalid('图谱已有更新，请重新打开编辑器后再提交',409);
 let next, previous;
 if(op.action==='undo'){
  if(!undo||undo.revision!==op.revision-1)invalid('没有可撤销的操作',409);
  next=undo;
 }else{
  previous=structuredClone(data);next=data;
  if(op.action==='delete'){
   const list=data[op.collection];
   if(!list.some(x=>x.id===op.id))invalid('记录不存在',404);
   if(op.collection==='groups'&&data.edges.some(e=>[e.group,e.fromDomain,e.toDomain].includes(op.id)))invalid('请先移动或删除使用该流程的连线');
   data[op.collection]=list.filter(x=>x.id!==op.id);
   if(op.collection==='nodes')data.edges=data.edges.filter(x=>x.from!==op.id&&x.to!==op.id);
  }else if(op.action==='save')saveRecord(data,op.collection,op.record);
  else if(op.action==='connect'&&op.collection==='edges'){
   if(!op.records?.length)invalid('请至少选择一个目标节点');
   saveConnections(data,op.records,op.records[0]?.from);
  }else if(op.action==='create-node'&&op.collection==='nodes'){
   saveRecord(data,'nodes',op.record,true);
   saveConnections(data,op.records,op.record.id,op.direction!=='in');
  }else invalid('未知操作');
 }
 next.revision=op.revision+1;
 const result=await bucket.put(key,JSON.stringify({...next,undo:previous}),{onlyIf:etag?{etagMatches:etag}:{etagDoesNotMatch:'*'}});
 if(!result)invalid('另一处编辑已保存，请重新打开编辑器后再提交',409);
 return next;
}
const json=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json; charset=UTF-8','Cache-Control':'no-store'}});
async function rpc(req,bucket,key){
 const msg=await req.json(); const out=v=>json({jsonrpc:'2.0',id:msg.id??null,...v});
 if(msg.method==='server/discover')return out({result:{supportedVersions:['2026-07-28'],capabilities:{tools:{}},serverInfo:{name:'flow-atlas',version:'1.0'}}});
 if(msg.method==='initialize')return out({result:{protocolVersion:msg.params?.protocolVersion||'2025-03-26',capabilities:{tools:{}},serverInfo:{name:'flow-atlas',version:'1.0'}}});
 if(msg.method?.startsWith('notifications/'))return new Response(null,{status:202});
 if(msg.method==='tools/list')return out({result:{tools:toolsList}});
 if(msg.method!=='tools/call')return out({error:{code:-32601,message:'Unknown method'}});
 try{
  if(!key)invalid('请登录后使用图谱',401);
  const {name,arguments:a={}}=msg.params||{};
  if(!toolsList.some(t=>t.name===name))invalid('未知工具');
  const result=name==='read_atlas'?(await readAtlas(bucket,key)).data:await apply(bucket,key,name==='delete_record'?{action:'delete',collection:a.collection,revision:a.revision,id:a.id}:{action:'save',collection:name.slice(5),revision:a.revision,record:a.record});
  return out({result:{content:[{type:'text',text:JSON.stringify(name==='read_atlas'?result:{revision:result.revision})}]}});
 }catch(e){return out({result:{isError:true,content:[{type:'text',text:e.status?e.message:'读取或保存失败'}]}})}
}
export function handler(req,env){
 return (async()=>{
 const path=new URL(req.url).pathname, uid=req.headers.get('oai-authenticated-user-id'),key=uid?'atlas/'+encodeURIComponent(uid)+'.json':null;
 if(path==='/mcp'&&req.method==='POST')return await rpc(req,env.BUCKET,key);
 if(path==='/api/export'&&req.method==='GET'){
  if(!key)invalid('请使用站点所有者的账号登录',401);
  const {data}=await readAtlas(env.BUCKET,key);
  const exportedAt=new Date().toISOString();
  const name='flow-atlas-'+exportedAt.replace(/[:.]/g,'-')+'.json';
  return new Response(JSON.stringify({formatVersion:1,exportedAt,...data},null,2)+'\n',{headers:{'Content-Type':'application/json; charset=utf-8','Content-Disposition':'attachment; filename="'+name+'"','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});
 }
 if(path==='/api/atlas'){
  if(!key)invalid('请使用站点所有者的账号登录',401);
  if(req.method==='GET'){
   const {data,undo}=await readAtlas(env.BUCKET,key);
   return json({...data,canUndo:Boolean(undo&&undo.revision===data.revision-1)});
  }
  if(req.method==='POST'){
   if(req.headers.has('origin')&&req.headers.get('origin')!==new URL(req.url).origin)invalid('来源无效',403);
   if(!(req.headers.get('content-type')||'').startsWith('application/json'))invalid('需要 JSON 请求',415);
   const op=await req.json();
   return json({...await apply(env.BUCKET,key,op),canUndo:op.action!=='undo'});
  }
 }
 const asset=assets[path==='/'?'/index.html':path];
 if(asset&&req.method==='GET')return new Response(asset.body,{headers:{'Content-Type':asset.type,'Cache-Control':'no-cache','X-Content-Type-Options':'nosniff'}});
 return json({error:'未找到'},404);
 })().catch(e=>json({error:e.status?e.message:'服务暂时不可用，请稍后重试'},e.status||500));
}
