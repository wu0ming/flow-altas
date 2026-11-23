'use strict';

const selection = new Set();
let multi = false, presentation = 'flat', arrangement = 0, radialCenter = '';
const initialCamera = {yaw: -.38, pitch: .38, scale: 1, x:0, y:0};
let camera = {...initialCamera}, sceneView, spacePan=false;
const layouts = new Map();

const fromDomain = edge => edge.fromDomain || edge.group;
const toDomain = edge => edge.toDomain || edge.group;
function seededRandom(key) {
 let value = 2166136261;
 for (const c of key) value = Math.imul(value ^ c.charCodeAt(0), 16777619);
 return () => ((value = (Math.imul(value, 1664525) + 1013904223) >>> 0) / 4294967296);
}
function cachedLayout(key, create) {
 const identity = [data.revision, arrangement, key].join('|');
 if (!layouts.has(identity)) {
  if (layouts.size >= 12) layouts.clear();
  layouts.set(identity, create());
 }
 return layouts.get(identity);
}
function neighborsOf(nodes, edges) {
 const neighbors = new Map(nodes.map(n => [n.id, new Set()]));
 for (const e of edges) {
  neighbors.get(e.from).add(e.to);
  neighbors.get(e.to).add(e.from);
 }
 return neighbors;
}
function spatialLayout(mode, nodes, edges, groups, root, pass) {
 const points = [], links = [], copies = [], planes = [];
 const stations = new Map(nodes.map(n => [n.id, new Map()]));
 function place(id, domain, position) {
  const point = {id, domain, ...position};
  points.push(point);
  stations.get(id).set(domain, point);
  return point;
 }
 if (mode === 'layers') {
  const members = new Map(groups.map(g => [g.id, new Set()]));
  for (const e of edges) {
   members.get(fromDomain(e)).add(e.from);
   members.get(toDomain(e)).add(e.to);
  }
  const connected = new Set([...members.values()].flatMap(set => [...set]));
  const unassigned = nodes.filter(n => !connected.has(n.id)).map(n => n.id);
  const layers = groups.filter(g => members.get(g.id).size).map(g => ({...g, members: [...members.get(g.id)]}));
  if (unassigned.length) layers.push({id: '', name: '未连接', members: unassigned});
  const counts = new Map();
  for (const g of layers) for (const id of g.members) counts.set(id, (counts.get(id) || 0) + 1);
  const random = seededRandom('layers' + pass), anchors = new Map();
  for (const [id, count] of counts) {
   if (count < 2) continue;
   const angle = anchors.size * 2.4 + pass * .26;
   const radius = 65 + 10 * Math.sqrt(anchors.size) + random() * 32;
   anchors.set(id, {x: Math.cos(angle)*radius, z: Math.sin(angle)*radius*.75});
  }
  layers.forEach((g, index) => {
   const y = (index - (layers.length - 1)/2)*68;
   const width = Math.max(174, Math.sqrt(g.members.length)*46);
   const depth = width*.61;
   planes.push({id: g.id, name: g.name, y, width, depth});
   const placements = g.members.filter(id => anchors.has(id)).map(id => place(id, g.id, {...anchors.get(id), y}));
   for (const id of g.members.filter(id => !anchors.has(id))) {
    let winner, best = -Infinity;
    for (let j=0; j<32; j++) {
     const x = (random()-.5)*width*1.78, z = (random()-.5)*depth*1.72;
     const clearance = placements.reduce((d,p) => Math.min(d, Math.hypot(x-p.x,z-p.z)), width);
     const score = clearance - .18*Math.hypot(x,z);
     if (score > best) {winner = {x,y,z}; best = score}
    }
    placements.push(place(id, g.id, winner));
   }
  });
  for (const instances of stations.values()) {
   const ordered = [...instances.values()];
   ordered.slice(1).forEach((p,i) => copies.push({a: ordered[i], b:p}));
  }
 } else {
  const neighbors = neighborsOf(nodes, edges);
  const order = [...neighbors.keys()].sort((a,b) => neighbors.get(b).size-neighbors.get(a).size || a.localeCompare(b));
  if (order.includes(root)) order.splice(0, 0, ...order.splice(order.indexOf(root), 1));
  const seen = new Set(), components = [];
  for (const center of order) {
   if (seen.has(center)) continue;
   const depth = new Map([[center,0]]), queue = [center];
   seen.add(center);
   for (let i=0; i<queue.length; i++) for (const id of neighbors.get(queue[i])) {
    if (seen.has(id)) continue;
    seen.add(id); queue.push(id); depth.set(id, depth.get(queue[i])+1);
   }
   components.push(depth);
  }
  const columns = Math.ceil(Math.sqrt(components.length)), rows = Math.ceil(components.length/columns);
  components.forEach((depth, i) => {
   const rings = new Map(), random = seededRandom('radial' + i + '/' + pass);
   for (const [id,d] of depth) {
    if (!rings.has(d)) rings.set(d, []);
    rings.get(d).push(id);
   }
   const cx = (i%columns-(columns-1)/2)*310, cy = (Math.floor(i/columns)-(rows-1)/2)*305;
   const furthest = Math.max(1,...rings.keys());
   for (const [d,ids] of rings) {
    const offset = random()*Math.PI*2;
    ids.forEach((id,j) => {
     const r = 128*d/furthest, t = offset+j*2.39996, v = ids.length===1 ? .25*Math.sin(offset) : .9*(1-2*(j+.5)/ids.length);
     place(id, '', {x:cx+r*Math.cos(t)*Math.sqrt(1-v*v),y:cy+r*v,z:r*Math.sin(t)*Math.sqrt(1-v*v),center:d===0});
    });
   }
  });
 }
 for (const e of edges) links.push({edge:e,a:stations.get(e.from).get(mode==='layers'?fromDomain(e):''),b:stations.get(e.to).get(mode==='layers'?toDomain(e):'')});
 return {points, links, copies, planes, center:points.find(p => p.center)?.id};
}

function recomputedFlat(nodes, edges, mobile, pass) {
 const cols = Math.max(mobile?4:7, Math.ceil(Math.sqrt(nodes.length*(mobile?.75:1.8))));
 const rows = Math.max(5, Math.ceil(nodes.length/cols)+1);
 const width = Math.max(mobile?478:900,cols*100), height = rows*84;
 const random = seededRandom('flat'+pass);
 const points = new Map(nodes.map(n => [n.id,{x:random()*width,y:random()*height}]));
 const all = [...points.values()], interval = Math.max(1,Math.ceil(all.length/110));
 for (let iteration=0; iteration<48; iteration++) {
  for (const p of all) {p.dx=(width/2-p.x)*.012; p.dy=(height/2-p.y)*.012}
  for (let i=0; i<all.length; i++) for (let j=i+1+iteration%interval; j<all.length; j+=interval) {
   const a=all[i],b=all[j],dx=a.x-b.x,dy=a.y-b.y,d=Math.max(4,Math.hypot(dx,dy)),f=Math.min(18,8700/(d*d))/d;
   a.dx+=dx*f; a.dy+=dy*f; b.dx-=dx*f; b.dy-=dy*f;
  }
  for (const e of edges) {
   const a=points.get(e.from),b=points.get(e.to),dx=b.x-a.x,dy=b.y-a.y,d=Math.max(1,Math.hypot(dx,dy)),f=(d-110)*.062/d;
   a.dx+=dx*f; a.dy+=dy*f; b.dx-=dx*f; b.dy-=dy*f;
  }
  for (const p of all) {p.x+=Math.max(-20,Math.min(20,p.dx)); p.y+=Math.max(-20,Math.min(20,p.dy))}
 }
 const slots = Array.from({length:cols*rows},(_,i)=>({x:(i%cols+.5)*width/cols,y:(Math.floor(i/cols)+.5)*height/rows-8}));
 for (const [id,p] of points) {
  let best=0, distance=Infinity;
  slots.forEach((s,i)=>{const d=(s.x-p.x)**2+(s.y-p.y)**2;if(d<distance){distance=d;best=i}});
  points.set(id,slots.splice(best,1)[0]);
 }
 return {points,width,height};
}
function paintSpace() {
 if (!sceneView) return;
 const {svg,model,activeEdges} = sceneView;
 const compact = matchMedia('(max-width:650px)').matches;
 const width = compact ? 420 : 860, height = compact ? 540 : 490;
 const {yaw,pitch,scale} = camera, c=Math.cos(yaw),s=Math.sin(yaw),ct=Math.cos(pitch),st=Math.sin(pitch);
 const span = Math.max(120,...model.points.map(p=>Math.hypot(p.x,p.y,p.z)),...model.planes.map(p=>Math.hypot(p.width,p.y,p.depth)));
 const size = Math.min((width-62)/(span*2),(height-56)/(span*2))*scale;
 function project(p) {
  const x=p.x*c+p.z*s, depth=p.z*c-p.x*s;
  const y=p.y*ct-depth*st, z=p.y*st+depth*ct, k=1/(1-z/(span*5));
  return {x:width/2+camera.x+x*size*k,y:height/2+camera.y+y*size*k,z,k};
 }
 const line=(a,b)=>'M '+a.x+' '+a.y+' L '+b.x+' '+b.y;
 const active = new Set(activeEdges.map(e=>e.id));
 const connected = new Set(activeEdges.flatMap(e=>[e.from,e.to]));
 const filtered = layer || scope!=='全部' || focus || selection.size;
 const planeArt = model.planes.map(p=>{
  const q=[[-1,-1],[1,-1],[1,1],[-1,1]].map(([u,v])=>project({x:p.width*u,y:p.y,z:p.depth*v}));
  const color=p.id?layerColor(p.id):'#aaa', left=q.reduce((a,b)=>a.x<b.x?a:b);
  const dim=layer&&p.id!==layer?.35:1;
  return '<g opacity="'+dim+'" pointer-events="none"><polygon points="'+q.map(v=>v.x+','+v.y).join(' ')+'" fill="'+color+'" fill-opacity=".09" stroke="'+color+'" stroke-opacity=".55"/><path d="'+line(q[0],q[2])+line(q[1],q[3])+'" stroke="'+color+'" opacity=".15"/><text class="plane-name" x="'+Math.max(6,left.x-8)+'" y="'+(left.y-6)+'" fill="'+color+'">'+esc(p.name)+'</text></g>';
 }).join('');
 const identityArt = model.copies.map(({a,b})=>'<path class="space-identity" data-identity="'+esc(a.id)+'" d="'+line(project(a),project(b))+'" opacity="'+(selection.has(a.id)||focus===a.id?.95:filtered?.19:.52)+'"/>').join('');
 const details=scale>=1.4, channelLabels=[];
 const routeArt = model.links.map(({a,b,edge})=>{
  const u=project(a),v=project(b),d=Math.hypot(v.x-u.x,v.y-u.y)||1,ux=(v.x-u.x)/d,uy=(v.y-u.y)/d;
  const start={x:u.x+ux*8,y:u.y+uy*8},end={x:v.x-ux*8,y:v.y-uy*8};
  const color=layerColor(edge.group),on=active.has(edge.id),path=line(start,end);
  if(details&&on)channelLabels.push({edge,u,v});
  const tip=(p,dir)=>'M '+(p.x-dir*ux*6-uy*3)+' '+(p.y-dir*uy*6+ux*3)+' L '+p.x+' '+p.y+' L '+(p.x-dir*ux*6+uy*3)+' '+(p.y-dir*uy*6-ux*3);
  return '<g class="space-link" data-edge="'+esc(edge.id)+'" tabindex="0" role="button" aria-label="'+esc(getNode(edge.from).name+' 至 '+getNode(edge.to).name+' · '+channelText(edge))+'" opacity="'+(on?.88:.13)+'"><title>'+esc(edge.label+' · '+channelText(edge))+'</title><path d="'+path+'" stroke="transparent" stroke-width="10"/><path d="'+path+'" stroke="'+color+'" stroke-width="'+(on&&filtered?2.1:1.45)+'" '+(edge.status==='已使用'?'':'stroke-dasharray="5 4"')+'/><path d="'+tip(end,1)+(edge.both?tip(start,-1):'')+'" stroke="'+color+'"/></g>';
 }).join('');
 const dots=model.points.map(p=>{
  const q=project(p),node=getNode(p.id),chosen=selection.has(p.id)||focus===p.id;
  const visible=!filtered||connected.has(p.id)||chosen;
  return {...q,p,node,chosen,visible,r:(chosen||p.center?8:6)*q.k};
 }).sort((a,b)=>a.z-b.z);
 const nodeArt=dots.map(({x,y,p,node,chosen,visible,r})=>{
  const domain=p.domain||memberships(p.id)[0]?.id,color=domain?layerColor(domain):'#a7a7a7';
  return '<g class="space-node" data-node="'+esc(p.id)+'" data-domain="'+esc(p.domain)+'" role="button" tabindex="0" aria-pressed="'+chosen+'" aria-label="'+esc(node.name+(p.domain?' · '+getGroup(p.domain).name:''))+'" transform="translate('+x+' '+y+')" opacity="'+(visible?1:.27)+'"><title>'+esc(node.name)+'</title><circle r="12" fill="transparent"/>'+(chosen||p.center?'<circle r="'+(r+4)+'" stroke="'+color+'" fill="'+color+'" fill-opacity=".17"/>':'')+'<circle r="'+r+'" fill="#231f20" stroke="'+color+'" stroke-width="2"/><circle r="2.1" fill="'+color+'"/></g>';
 }).join('');
 const occupied=[];
 function reserve(boxes){
  const available=boxes.find(b=>b.x>2&&b.x+b.w<width-2&&b.y>2&&b.y+b.h<height-2&&!occupied.some(o=>b.x<o.x+o.w&&b.x+b.w>o.x&&b.y<o.y+o.h&&b.y+b.h>o.y));
  if(available)occupied.push(available);
  return available;
 }
 const measure=(text,size)=>Array.from(text).reduce((n,c)=>n+(/[\u0100-\uffff]/u.test(c)?size:size*.59),0);
 const labelArt=[...dots].sort((a,b)=>Number(b.chosen)-Number(a.chosen)||Number(b.visible)-Number(a.visible)||b.z-a.z).map(({x,y,p,node,r,chosen,visible})=>{
  if(!visible&&dots.length>22)return '';
  const card=details&&visible, name=node.name.length>23?node.name.slice(0,22)+'…':node.name;
  const type=node.type.length>22?node.type.slice(0,21)+'…':node.type;
  const w=card?Math.max(measure(name,12),measure(type,10))+15:measure(name,12)+5,h=card?31:14;
  const position=reserve([
   {x:x+r+4,y:y-h/2,w,h},{x:x-w-r-4,y:y-h/2,w,h},
   {x:x-w/2,y:y+r+4,w,h},{x:x-w/2,y:y-h-r-4,w,h}
  ]);
  if(!position)return '';
  const {x:left,y:top}=position;
  if(!card)return '<text class="space-label" x="'+left+'" y="'+(top+11)+'" opacity="'+(visible?1:.4)+'">'+esc(name)+'</text>';
  return '<g class="space-detail-node '+(chosen?'chosen':'')+'" data-node="'+esc(p.id)+'" data-domain="'+esc(p.domain)+'" aria-hidden="true" transform="translate('+left+' '+top+')"><rect width="'+w+'" height="'+h+'" rx="5"/><text x="7" y="13">'+esc(name)+'</text><text class="space-node-type" x="7" y="25">'+esc(type)+'</text></g>';
 }).join('');
 const channelArt=channelLabels.map(({edge,u,v})=>{
  const title=edge.channelType|| (edge.channelName?'数据通道':'待补通道');
  const widthForTag=Math.max(measure(title.slice(0,16),10.5),measure(edge.channelName.slice(0,19),10.5))+18;
  const h=edge.channelName?28:17,x=(u.x+v.x)/2,y=(u.y+v.y)/2;
  const position=reserve([0,-21,21,-42,42].map(offset=>({x:x-widthForTag/2,y:y+offset-h/2,w:widthForTag,h})));
  if(!position)return '';
  const cy=position.y+h/2;
  return (cy===y?'':'<path class="channel-stem" d="'+line({x,y},{x,y:cy})+'"/>')+channelTag(edge,x,cy);
 }).join('');
 svg.setAttribute('viewBox','0 0 '+width+' '+height);
 svg.innerHTML=planeArt+identityArt+routeArt+nodeArt+labelArt+channelArt;
 const meter=screen.querySelector('.zoom b');if(meter)meter.textContent=Math.round(scale*100)+'%';
}
function mountSpace(edges) {
 const svg=screen.querySelector('.space-view');
 if(!svg){sceneView=null;return}
 const model=cachedLayout(presentation+'|'+radialCenter,()=>spatialLayout(presentation,data.nodes,data.edges,data.groups,radialCenter,arrangement));
 sceneView={svg,model,activeEdges:edges};
 screen.querySelector('.space-caption').textContent=presentation==='layers'?'彩色箭头表示数据通道，灰色点线连接同一工具在不同层的显示点。':(model.center?'中心为 '+getNode(model.center).name+'，按连接步数向外排列。':'暂无节点。');
 paintSpace();
 const fingers=new Map();
 let drag=null,moved=false,previousDistance=0,pending=0,panning=false;
 function redraw(){if(!pending)pending=requestAnimationFrame(()=>{pending=0;if(sceneView?.svg===svg)paintSpace()})}
 function distance(){const [a,b]=fingers.values();return Math.hypot(a.x-b.x,a.y-b.y)}
 svg.addEventListener('pointerdown',e=>{
  if(![0,1,2].includes(e.button)||fingers.size>=2)return;
  fingers.set(e.pointerId,{x:e.clientX,y:e.clientY});
  if(fingers.size===1){drag={clientX:e.clientX,clientY:e.clientY,...camera};moved=false;panning=spacePan||e.shiftKey||e.button!==0}
  if(fingers.size===2){previousDistance=distance();moved=true}
 });
 svg.addEventListener('pointermove',e=>{
  if(!fingers.has(e.pointerId))return;
  fingers.set(e.pointerId,{x:e.clientX,y:e.clientY});
  if(fingers.size===2){
   const d=distance();camera.scale=clampZoom(camera.scale*d/Math.max(1,previousDistance));previousDistance=d;
  }else if(drag&&fingers.size===1){
   const dx=e.clientX-drag.clientX,dy=e.clientY-drag.clientY;
   if(!moved&&Math.abs(dx)+Math.abs(dy)<5)return;
   moved=true;
   if(panning){
    const ct=svg.getScreenCTM(),unit=Math.hypot(ct.a,ct.b)||1;
    camera.x=drag.x+dx/unit;camera.y=drag.y+dy/unit;
   }else{
    camera.yaw=drag.yaw+dx*.009;camera.pitch=Math.max(-1.48,Math.min(1.48,drag.pitch+dy*.008));
   }
  }
  if(moved){for(const id of fingers.keys())if(!svg.hasPointerCapture(id))svg.setPointerCapture(id);redraw()}
 });
 function release(e){
  fingers.delete(e.pointerId);
  const remaining=[...fingers.values()][0];
  drag=remaining?{clientX:remaining.x,clientY:remaining.y,...camera}:null;
 }
 svg.addEventListener('contextmenu',e=>{if(moved||fingers.size)e.preventDefault()});
 for(const event of ['pointerup','pointercancel','lostpointercapture'])svg.addEventListener(event,release);
 svg.addEventListener('pointerleave',e=>{if(!svg.hasPointerCapture(e.pointerId))release(e)});
 svg.addEventListener('click',e=>{if(moved){e.stopPropagation();moved=false}},true);
 svg.addEventListener('wheel',e=>{e.preventDefault();camera.scale=clampZoom(camera.scale*Math.exp(-Math.max(-100,Math.min(100,e.deltaY))*.0024));redraw()},{passive:false});
 svg.addEventListener('keydown',e=>{
  const delta={ArrowLeft:[-.13,0],ArrowRight:[.13,0],ArrowUp:[0,-.1],ArrowDown:[0,.1]}[e.key];
  if(!delta)return;
  e.preventDefault();camera.yaw+=delta[0];camera.pitch=Math.max(-1.48,Math.min(1.48,camera.pitch+delta[1]));paintSpace();svg.focus({preventScroll:true});
 });
}
function selectionPanel(edges) {
 const ids=[...selection], direct=edges.filter(e=>selection.has(e.from)&&selection.has(e.to));
 const adj=neighborsOf(data.nodes,edges);
 const common=ids.length>1?[...adj.get(ids[0])].filter(id=>!selection.has(id)&&ids.every(n=>adj.get(n).has(id))):[];
 return '<aside class="panel atlas-side"><div class="card-head"><span class="card-title">'+textIcon('link','多节点对照')+'</span><span class="count">'+ids.length+' 个</span></div><div class="detail-body"><div class="layer-tags">'+ids.map(id=>'<button data-remove="'+esc(id)+'" aria-label="移除 '+esc(getNode(id).name)+'">'+esc(getNode(id).name)+' ×</button>').join('')+'</div>'+(ids.length?'':'<p>点选图中节点，或从「添加节点」搜索。再次点选可取消。</p>')+'<div class="detail-sub">直接通道<span>'+direct.length+'</span></div>'+(direct.length?edgeList(direct):'<p>所选节点间暂无直接连线。</p>')+'<div class="detail-sub">共同相邻工具<span>'+common.length+'</span></div><p>'+esc(common.map(id=>getNode(id).name).join('、')||(ids.length<2?'选择至少两个节点后显示。':'当前范围内没有共同相邻工具。'))+'</p></div></aside>';
}
function centerSpatialNode(id){
 const svg=sceneView?.svg;
 const node=svg?.querySelector('.space-node[data-node="'+CSS.escape(id)+'"]');
 if(!node)return;
 const {width,height}=svg.viewBox.baseVal,{e:x,f:y}=node.transform.baseVal.getItem(0).matrix;
 camera.x+=width/2-x;camera.y+=height/2-y;paintSpace();
}
