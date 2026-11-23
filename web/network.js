// Stable station positions preserve spatial context when a layer or node is highlighted.
// New stations fill vacant slots near their neighbors; no edge is inferred from a position.
const atlasStations={
 inbox:[74,102,61,47],reading:[74,213,61,124],library:[267,107,194,112],
 assistant:[431,143,282,195],reviewer:[423,40,402,108],'memory-hub':[653,51,403,47],
 briefing:[614,208,307,268],delivery:[809,203,410,340],feedback:[806,88,410,258],
 archive:[626,342,252,391],index:[805,385,363,468],'file-drop':[291,294,108,295]
};
const domainColors={memory:'#eaaa72',knowledge:'#b89deb',office:'#7dbacb',files:'#f2c76d',research:'#85c8a5',capture:'#e28ca4'};
function layerColor(id){
 if(Object.hasOwn(domainColors,id))return domainColors[id];
 let hash=0;for(const char of id)hash=(hash*31+char.charCodeAt(0))>>>0;
 return 'hsl('+hash%360+' 56% 70%)';
}
function memberships(id){return data.groups.filter(g=>data.edges.some(e=>(e.from===id&&fromDomain(e)===g.id||e.to===id&&toDomain(e)===g.id)))}
function stationLayout(nodes,edges,mobile){
 const width=mobile?478:900,baseHeight=mobile?530:450,offset=mobile?2:0,points=new Map();
 let height=baseHeight;
 for(const n of nodes){const preset=Object.hasOwn(atlasStations,n.id)&&atlasStations[n.id];if(preset)points.set(n.id,{x:preset[offset],y:preset[offset+1]})}
 for(const n of nodes){
  if(points.has(n.id))continue;
  const neighbors=edges.filter(e=>e.from===n.id||e.to===n.id).map(e=>points.get(e.from===n.id?e.to:e.from)).filter(Boolean);
  const goal=neighbors.length?{x:neighbors.reduce((s,p)=>s+p.x,0)/neighbors.length,y:neighbors.reduce((s,p)=>s+p.y,0)/neighbors.length}:{x:width/2,y:height/2};
  let best,score=Infinity;
  for(let y=43;y<=height+65;y+=68)for(let x=63;x<=width-50;x+=105){
   if([...points.values()].some(p=>Math.abs(x-p.x)<101&&Math.abs(y-p.y)<62))continue;
   const cost=Math.hypot(x-goal.x,y-goal.y)+(y>height-30?height:0);
   if(cost<score){best={x,y};score=cost}
  }
  if(!best)best={x:65,y:height+40};
  points.set(n.id,best);height=Math.max(height,best.y+52);
 }
 return {width,height,points};
}
function atlasDiagram(nodes,edges,activeEdges,layer,chosen){
 if(!nodes.length)return '<p class="empty">还没有节点，可在节点管理中添加。</p>';
 const mobile=matchMedia('(max-width:650px)').matches,{points,width,height}=arrangement?cachedLayout('flat|'+mobile,()=>recomputedFlat(nodes,edges,mobile,arrangement)):stationLayout(nodes,edges,mobile);
 const activeIds=new Set(activeEdges.map(e=>e.id)),activeNodes=new Set(activeEdges.flatMap(e=>[e.from,e.to])),filtered=layer||chosen||selection.size||scope!=='全部';
 if(chosen)activeNodes.add(chosen);for(const id of selection)activeNodes.add(id);
 const defs=data.groups.map((g,i)=>'<marker id="head'+i+'" viewBox="0 0 8 8" markerWidth="5" markerHeight="5" refX="6.6" refY="4" orient="auto-start-reverse"><path d="m0 0 8 4-8 4 2-4z" fill="'+layerColor(g.id)+'"/></marker>').join('');
 const parallels=new Map(),channelLabels=[];
 const wires=edges.map(e=>{
  const a=points.get(e.from),b=points.get(e.to);if(!a||!b)return '';
  const dx=b.x-a.x,dy=b.y-a.y,len=Math.hypot(dx,dy)||1,ux=dx/len,uy=dy/len,r=18;
  const key=[e.from,e.to].sort().join(' '),index=parallels.get(key)||0;parallels.set(key,index+1);
  const bend=index?Math.ceil(index/2)*(index%2?18:-18):0;
  const path='M '+(a.x+ux*r)+' '+(a.y+uy*r)+' Q '+((a.x+b.x)/2-uy*bend)+' '+((a.y+b.y)/2+ux*bend)+' '+(b.x-ux*r)+' '+(b.y-uy*r);
  const marker='url(#head'+data.groups.findIndex(g=>g.id===e.group)+')';
  const border=Math.min(38/Math.max(.001,Math.abs(ux)),14/Math.max(.001,Math.abs(uy)))+2;
  const deepPath='M '+(a.x+ux*border)+' '+(a.y+uy*border)+' Q '+((a.x+b.x)/2-uy*bend)+' '+((a.y+b.y)/2+ux*bend)+' '+(b.x-ux*border)+' '+(b.y-uy*border);
  const midX=(a.x+b.x)/2-uy*bend/2,midY=(a.y+b.y)/2+ux*bend/2;
  const shift=Math.abs(dy)<32&&Math.abs(dx)<150?-16:0;
  if(activeIds.has(e.id))channelLabels.push('<g class="deep-only">'+(shift?'<path class="channel-stem" d="M '+midX+' '+midY+'v'+shift+'"/>':'')+channelTag(e,midX,midY+shift,true)+'</g>');
  const stroke=' stroke="'+layerColor(e.group)+'" marker-end="'+marker+'" '+(e.both?'marker-start="'+marker+'"':'')+' '+(e.status==='已使用'?'':'stroke-dasharray="4 4"');
  return '<g data-wire="'+esc(e.id)+'" class="atlas-wire '+(activeIds.has(e.id)?'':'faded')+'"><title>'+esc(getGroup(e.group)?.name)+' · '+esc(e.label)+' · '+esc(channelText(e))+'</title><path class="overview-only" d="'+path+'"'+stroke+'/>'+'<path class="deep-only" d="'+deepPath+'"'+stroke+'/></g>';
 }).join('');
 const stations=nodes.map(n=>{
  const p=points.get(n.id),layers=memberships(n.id),on=chosen===n.id||selection.has(n.id);
  const colors=layers.map(g=>layerColor(g.id));if(!colors.length)colors.push('#aaa');
  const segments=colors.map((c,i)=>'<circle r="15" fill="none" stroke="'+c+'" stroke-width="'+(colors.length>1?3.4:1.5)+'" pathLength="100" stroke-dasharray="'+(100/colors.length-(colors.length>1?3:0))+' 100" transform="rotate('+(i*360/colors.length-90)+')"/>').join('');
  const name=n.name.length>18?n.name.slice(0,17)+'…':n.name;
  const detailed='<g class="deep-only zoom-card"><rect x="-38" y="-14" width="76" height="28" rx="4" stroke="'+colors[0]+'"/><svg x="-34" y="-6" width="12" height="12" viewBox="0 0 24 24" stroke="'+colors[0]+'" fill="none" stroke-width="1.7">'+(shapes[n.icon]||shapes.grid)+'</svg><text x="-19" y="-1">'+esc(n.name.length>12?n.name.slice(0,11)+'…':n.name)+'</text><text class="zoom-type" x="-19" y="9">'+esc(n.type)+'</text></g>';
  return '<g class="station '+(on?'current ':'')+(filtered&&!activeNodes.has(n.id)?'faded':'')+'" tabindex="0" role="button" aria-pressed="'+on+'" aria-label="'+esc(n.name)+'" data-node="'+esc(n.id)+'" transform="translate('+p.x+' '+p.y+')"><title>'+esc(n.name)+' · '+esc(layers.map(g=>g.name).join(' / ')||'尚无域连接')+'</title><rect x="-31" y="-20" width="62" height="52" fill="transparent"/><g class="overview-only"><circle class="node-aura" r="20" fill="'+colors[0]+'" opacity=".09"/><circle r="15" fill="#191b1f"/>'+segments+'<svg x="-8" y="-8" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="'+colors[0]+'" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">'+(Object.hasOwn(shapes,n.icon)?shapes[n.icon]:shapes.grid)+'</svg><text y="32" text-anchor="middle">'+esc(name)+'</text></g>'+detailed+'</g>';
 }).join('');
 return '<svg class="atlas-svg '+(zoom>=1.4?'deep':'')+'" viewBox="0 0 '+width+' '+height+'" aria-label="整体信息流网络">'+ '<defs>'+defs+'</defs>'+wires+stations+channelLabels.join('')+'</svg>';
}
function domainKey(g){return '<i class="swatch" style="--ink:'+layerColor(g.id)+'"></i>'+esc(g.name)}
function atlasSide(layer,chosen,activeEdges){
 if(chosen){
  const node=getNode(chosen),groups=memberships(chosen);
  return '<aside class="panel atlas-side"><div class="card-head"><span class="card-title">'+textIcon('layers','节点详情')+'</span><button class="plain-icon" data-action="clear-node" aria-label="返回全图概况">'+icon('x')+'</button></div><div class="detail-body"><div class="identity"><span class="glyph">'+icon(node.icon)+'</span><div><h3>'+esc(node.name)+'</h3><small>'+esc(node.type)+' · '+esc(node.scope)+'</small></div></div><p>'+esc(node.note)+'</p><div class="layer-tags">'+groups.map(g=>'<button data-layer="'+esc(g.id)+'">'+domainKey(g)+'</button>').join('')+'</div><div class="detail-sub">当前可见关系<span>'+activeEdges.length+'</span></div>'+edgeList(activeEdges)+'</div></aside>';
 }
 if(layer){
  const g=getGroup(layer),nodes=uniqueNodes(activeEdges);
  return '<aside class="panel atlas-side"><div class="card-head"><span class="card-title">'+textIcon('layers','处理域详情')+'</span><button class="plain-icon" aria-label="显示所有处理域" data-layer="@all">'+icon('x')+'</button></div><div class="detail-body"><h3>'+domainKey(g)+'</h3><p>'+nodes.length+' 个节点 · '+activeEdges.length+' 条连线</p><button class="btn" data-group="'+esc(layer)+'">'+textIcon('route','展开域内流程')+'</button><div class="subhead"><b>参与的工具</b></div><div class="layer-tags">'+nodes.map(n=>'<button data-node="'+esc(n.id)+'">'+esc(n.name)+'</button>').join('')+'</div></div></aside>';
 }
 const bridges=data.nodes.map(n=>({n,gs:memberships(n.id)})).filter(({gs})=>gs.length>1).sort((a,b)=>b.gs.length-a.gs.length);
 return '<aside class="panel atlas-side"><div class="card-head"><span class="card-title">'+textIcon('layers','处理域')+'</span><span class="count">'+data.groups.length+'</span></div><div class="domain-list">'+data.groups.map(g=>'<button data-group="'+esc(g.id)+'">'+domainKey(g)+'<small>'+groupEdges(g.id).length+' 条</small></button>').join('')+'</div><div class="card-head"><span class="card-title">'+textIcon('link','跨域节点')+'</span><span class="count">'+bridges.length+'</span></div><div class="layer-tags bridge-tags">'+bridges.map(({n,gs})=>'<button data-node="'+esc(n.id)+'" title="'+esc(gs.map(g=>g.name).join(' / '))+'">'+esc(n.name)+'</button>').join('')+'</div></aside>';
}
function connectionOverview(){
 const neighbors=new Map(data.nodes.map(n=>[n.id,[]]));
 for(const e of data.edges){neighbors.get(e.from)?.push(e.to);neighbors.get(e.to)?.push(e.from)}
 const seen=new Set(),parts=[];
 for(const n of data.nodes){
  if(seen.has(n.id))continue;
  const part=[],queue=[n.id];seen.add(n.id);
  for(let i=0;i<queue.length;i++){
   const id=queue[i];part.push(getNode(id));
   for(const other of neighbors.get(id)||[])if(!seen.has(other)){seen.add(other);queue.push(other)}
  }
  parts.push(part);
 }
 parts.sort((a,b)=>b.length-a.length);
 return '<div class="subhead"><h2>哪些工具已经连在一起</h2><small>'+parts.length+' 个连通分组</small></div><section class="panel connectivity"><p>沿已记录的连线追踪，暂时忽略方向，并计入待核实与规划中的关系。选择工具可回到全图查看。</p>'+parts.map(part=>'<div class="component"><b>'+part.length+' 个节点</b><div class="layer-tags">'+part.map(n=>'<button data-jump="'+esc(n.id)+'">'+esc(n.name)+'</button>').join('')+'</div></div>').join('')+'</section>';
}
