import test from 'node:test';import assert from 'node:assert/strict';import worker,{seed} from '../dist/server/index.js';
test('manual and MCP edits share state, stale changes are rejected, deleting a node removes its edges',async()=>{
 const objects=new Map(),BUCKET={get:async k=>objects.get(k),put:async(k,body,o)=>{const old=objects.get(k);if(old?old.etag!==o.onlyIf.etagMatches:!!o.onlyIf.etagMatches)return null;const v={etag:crypto.randomUUID(),json:async()=>JSON.parse(body)};objects.set(k,v);return v}};
 const call=(path,payload,user='qa')=>worker.fetch(new Request('https://example.test'+path,{method:payload?'POST':'GET',headers:{'content-type':'application/json',...(user?{'oai-authenticated-user-id':user}:{})},body:payload&&JSON.stringify(payload)}),{BUCKET});
 assert.equal((await call('/api/atlas',undefined,'')).status,401);
 const init=await (await call('/api/atlas')).json();assert.equal(init.nodes.length,seed.nodes.length);
 for(const e of init.edges){assert.ok(init.nodes.some(n=>n.id===e.from)&&init.nodes.some(n=>n.id===e.to));assert.ok(init.groups.some(g=>g.id===e.group))}
 const rpc=async(name,args)=>{const res=await call('/mcp',{jsonrpc:'2.0',id:1,method:'tools/call',params:{name,arguments:args}});return (await res.json()).result};
 const node={...seed.nodes[0],id:'qa-node',name:'测试节点'};
 assert.equal((await call('/api/atlas',{action:'save',collection:'nodes',record:node,revision:0})).status,200);
 let snapshot=JSON.parse((await rpc('read_atlas',{})).content[0].text);assert.ok(snapshot.nodes.some(n=>n.id===node.id));
 const edge={...seed.edges[0],id:'qa-edge',from:node.id};assert.ok(!(await rpc('save_edges',{record:edge,revision:1})).isError);
 assert.ok((await rpc('save_edges',{record:edge,revision:1})).isError);
 assert.ok((await rpc('save_edges',{record:{...edge,to:'missing'},revision:2})).isError);
 assert.ok(!(await rpc('delete_record',{collection:'nodes',id:node.id,revision:2})).isError);
 snapshot=await(await call('/api/atlas')).json();assert.equal(snapshot.revision,3);assert.ok(!snapshot.nodes.some(n=>n.id===node.id));assert.ok(!snapshot.edges.some(e=>e.id===edge.id));
 assert.equal((await(await call('/api/atlas',undefined,'separate')).json()).revision,0);
 const download=await call('/api/export');
 assert.equal(download.status,200);
 assert.match(download.headers.get('content-disposition'),/^attachment; filename="flow-atlas-.*\.json"/);
 const exported=await download.json();
 assert.equal(exported.formatVersion,1);
 for(const field of ['nodes','edges','groups','revision'])assert.deepEqual(exported[field],snapshot[field]);
 assert.equal(exported.edges.find(e=>e.id==='demo-5').channelName,'示例工作台');
 assert.equal((await call('/api/export',undefined,'')).status,401);
 const known=snapshot.edges.find(e=>e.id==='demo-5');
 const {channelType,channelName,...oldClientRecord}=known;
 assert.ok(!(await rpc('save_edges',{record:oldClientRecord,revision:3})).isError);
 const afterOld=await(await call('/api/atlas')).json();
 assert.equal(afterOld.edges.find(e=>e.id===known.id).channelName,channelName);
 assert.ok(!(await rpc('save_edges',{record:{...known,channelName:'测试应用'},revision:4})).isError);
 assert.equal((await(await call('/api/export')).json()).edges.find(e=>e.id===known.id).channelName,'测试应用');
 const crossLayer={...known,fromDomain:'office',toDomain:'files'};
 assert.ok((await rpc('save_edges',{record:{...crossLayer,toDomain:'unknown'},revision:5})).isError);
 assert.ok(!(await rpc('save_edges',{record:crossLayer,revision:5})).isError);
 assert.ok((await rpc('delete_record',{collection:'groups',id:'files',revision:6})).isError);
 const updated=await(await call('/api/export')).json();
 assert.equal(updated.edges.find(e=>e.id===known.id).toDomain,'files');
 const batch={collection:'edges',action:'connect',revision:6,records:[
  {...known,id:'qa-connect-1',from:'file-drop',to:'inbox'},
  {...known,id:'qa-connect-2',from:'file-drop',to:'reading'}
 ]};
 const badBatch={...batch,records:[batch.records[0],{...batch.records[1],to:'missing'}]};
 assert.equal((await call('/api/atlas',badBatch)).status,400);
 assert.equal((await(await call('/api/atlas')).json()).revision,6);
 const connected=await call('/api/atlas',batch);
 assert.equal(connected.status,200);
 const graph=await connected.json();
 assert.equal(graph.revision,7);
 assert.deepEqual(graph.edges.filter(e=>e.id.startsWith('qa-connect')).map(e=>[e.from,e.to]),[['file-drop','inbox'],['file-drop','reading']]);
 assert.equal((await call('/api/atlas',batch)).status,409);
 const newNode={...node,id:'qa-new-linked',name:'新建时一并连接'};
 const createNode={collection:'nodes',action:'create-node',revision:7,record:newNode,direction:'in',records:[
  {...known,id:'qa-create-edge-1',from:'inbox',to:newNode.id},
  {...known,id:'qa-create-edge-2',from:'reading',to:newNode.id}
 ]};
 const badCreate={...createNode,records:[createNode.records[0],{...createNode.records[1],from:'missing'}]};
 assert.equal((await call('/api/atlas',badCreate)).status,400);
 const afterBadCreate=await(await call('/api/atlas')).json();
 assert.equal(afterBadCreate.revision,7);
 assert.ok(!afterBadCreate.nodes.some(n=>n.id===newNode.id));
 assert.ok(!afterBadCreate.edges.some(e=>e.id===createNode.records[0].id));
 const created=await(await call('/api/atlas',createNode)).json();
 assert.equal(created.revision,8);
 assert.equal(created.edges.filter(e=>e.to===newNode.id).length,2);
 assert.equal((await call('/api/atlas',{collection:'nodes',action:'delete',id:newNode.id,revision:8})).status,200);
 assert.equal((await call('/api/atlas',{collection:'nodes',action:'undo',revision:8})).status,409);
 const restored=await(await call('/api/atlas',{collection:'nodes',action:'undo',revision:9})).json();
 assert.equal(restored.revision,10);
 assert.equal(restored.canUndo,false);
 assert.ok(restored.nodes.some(n=>n.id===newNode.id));
 assert.equal(restored.edges.filter(e=>e.to===newNode.id).length,2);
 const restoredExport=await(await call('/api/export')).json();
 assert.equal(restoredExport.undo,undefined);
 assert.equal(restoredExport.canUndo,undefined);
 const discover=await(await call('/mcp',{jsonrpc:'2.0',id:2,method:'tools/list'})).json();assert.equal(discover.result.tools.length,5);
});
