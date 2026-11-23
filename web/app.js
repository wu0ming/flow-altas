'use strict';
const $=s=>document.querySelector(s), screen=$('#screen'), dlg=$('#dialog');
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const opt=(v,t,sel)=>'<option value="'+esc(v)+'" '+(v===sel?'selected':'')+'>'+esc(t)+'</option>';
const selectBox=(id,options)=>'<label class="selectwrap"><select id="'+id+'" aria-label="'+({groupSelect:'选择视图',layerSelect:'高亮处理域',focusSelect:multi?'选择已有节点':'追踪节点',rootSelect:'放射中心'}[id]||'选择流程')+'">'+options+'</select>'+icon('chev')+'</label>';
let layer='',expanded=false,focusedDomain='';
let data, tab=['records','insights'].includes(location.hash.slice(1))?location.hash.slice(1):'map',group='@all',scope='全部',selected='',zoom=1,view='graph',focus='',collection='nodes',query='',insight='',submitting=false;
const exportButton='<a class="btn btnlink export-btn" href="/api/export" download>'+icon('download')+' 导出数据</a>';
const kinds={nodes:'节点',edges:'连线',groups:'流程'};
const getNode=id=>data.nodes.find(n=>n.id===id);
const getGroup=id=>data.groups.find(g=>g.id===id);
const groupEdges=id=>data.edges.filter(e=>(id==='@all'||e.group===id||fromDomain(e)===id||toDomain(e)===id)&&(scope==='全部'||e.scope==='通用'||e.scope===scope));
const uniqueNodes=edges=>[...new Set(edges.flatMap(e=>[e.from,e.to]))].map(getNode).filter(Boolean);
const textIcon=(i,s)=>icon(i)+' '+esc(s);
function toast(s){const t=$('#toast');t.textContent=s;t.classList.add('visible');clearTimeout(toast.timer);toast.timer=setTimeout(()=>t.classList.remove('visible'),2200)}
async function fetchData(){const res=await fetch('/api/atlas');const v=await res.json();if(!res.ok)throw Error(v.error||'图谱读取失败');data=v}
function stats(){return [[data.nodes.length,'个节点','grid'],[data.edges.length,'条连线','link'],[data.groups.length,'个流程','route']].map(([n,s,i])=>'<span class="metric">'+icon(i)+'<b>'+n+'</b>'+s+'</span>').join('')}
function syncTab(t){tab=t;history.replaceState(null,'','#'+t);render()}
function render(){
 $('#metrics').innerHTML=stats();document.querySelectorAll('[data-tab]').forEach(b=>{b.classList.toggle('active',b.dataset.tab===tab);b.setAttribute('aria-current',b.dataset.tab===tab?'page':'false')});
 if(tab==='map')renderMap();else if(tab==='records')renderRecords();else renderInsights();
}
function renderMap(){
 const available=data.groups.filter(g=>scope==='全部'||groupEdges(g.id).length);
 if(group!=='@all'&&!available.some(g=>g.id===group))group=available[0]?.id||'';
 const global=group==='@all';
 if(layer&&!getGroup(layer))layer='';
 if(focus&&!getNode(focus))focus='';
 for(const id of selection)if(!getNode(id))selection.delete(id);
 if(radialCenter&&!getNode(radialCenter))radialCenter='';
 const base=groupEdges(group);
 const scene=global&&view==='graph'&&presentation!=='flat';
 const within=global?base.filter(e=>!layer||[e.group,fromDomain(e),toDomain(e)].includes(layer)):base;
 const active=multi&&selection.size?within.filter(e=>selection.has(e.from)||selection.has(e.to)):global&&focus?within.filter(e=>e.from===focus||e.to===focus):within;
 const nodes=global?data.nodes:uniqueNodes(base);
 if(!global&&!multi&&!nodes.some(n=>n.id===selected))selected=[...nodes].sort((a,b)=>base.filter(e=>e.from===b.id||e.to===b.id).length-base.filter(e=>e.from===a.id||e.to===a.id).length)[0]?.id||'';
 const graph=scene?'<svg class="space-view" tabindex="0" role="group" aria-label="三维图谱，可使用方向键旋转"></svg>':global?atlasDiagram(nodes,data.edges,active,layer,focus):diagram(nodes,base);
 const controls='<div class="space-tools">'+(global?'<div class="seg" aria-label="图谱布局">'+[['flat','平面'],['layers','三维分层'],['radial','三维放射']].map(([id,name])=>'<button class="'+(presentation===id?'on':'')+'" data-presentation="'+id+'" aria-pressed="'+(presentation===id)+'">'+name+'</button>').join('')+'</div>':'')+
 '<button class="btn compact" data-action="multi" aria-pressed="'+multi+'">'+(multi?'多选 · '+selection.size:'多选节点')+'</button>'+
 (global?'<button class="btn compact" data-action="relayout">重新布局</button>':'')+(multi&&selection.size?'<button class="compact" data-action="clear-picks">清空</button>':'')+'</div>';
 const title=global?'整体信息流':'域内流程';
 const diagramSource=multi?(selection.size===1?[...selection][0]:''):global?focus:selected;
 const activeFlow=getGroup(group)||getGroup(layer);
 const inspector=multi?selectionPanel(within):global?atlasSide(layer,focus,active):detail(base);
 const folder=opt('@all','返回整体信息流',group)+available.map(g=>opt(g.id,g.name,group)).join('');
 screen.innerHTML='<div class="section-head"><h2>信息流地图</h2><div class="heading-controls">'+exportButton+'<div class="seg" aria-label="场景筛选">'+['全部','工作','生活'].map(s=>'<button data-scope="'+s+'" class="'+(s===scope?'on':'')+'" aria-pressed="'+(s===scope)+'">'+s+'</button>').join('')+'</div></div></div>'+ 
 '<div class="workspace '+(global?'atlas-workspace ':'')+(expanded?'expanded':'')+'"><section class="panel canvas-panel"><div class="card-head"><span class="card-title">'+textIcon('map',title)+'</span><div class="map-actions">'+(global?selectBox('layerSelect',opt('','全部处理域',layer)+data.groups.map(g=>opt(g.id,g.name,layer)).join('')):selectBox('groupSelect',folder))+'<button class="tiny" data-action="mode" aria-label="'+(view==='graph'?'切换到连线列表':'切换到图谱')+'">'+icon(view==='graph'?'list':'map')+'</button><button class="tiny" data-action="expand" aria-label="'+(expanded?'退出大图':'展开大图')+'">'+icon(expanded?'x':'fit')+'</button></div></div>'+
 (!global?'<div class="local-back"><button data-group="@all">'+icon('back')+' 整体信息流</button><span>点击连线标签可维护通道</span></div>':'')+
 controls+
 graphEditor(diagramSource,global?(focusedDomain||layer):group,activeFlow)+
 (global?'<div class="atlas-tools">'+(scene?'<span class="ring-key">拖动 · 滚轮或捏合缩放</span><button class="btn compact" data-action="space-pan" title="切换拖动方式，按住 Shift 也可平移" aria-pressed="'+spacePan+'">'+(spacePan?'平移中':'旋转中')+'</button>':'<span class="ring-key"><i></i>拖动平移 · 放大查看通道</span>')+selectBox('focusSelect',opt('',multi?'选择已有节点':'全部节点',focus)+data.nodes.map(n=>opt(n.id,n.name+(multi&&selection.has(n.id)?' ✓':''),focus)).join(''))+((layer||focus)?'<button class="reset" data-action="clear-all">清除选择</button>':'')+'</div>':'')+
 (scene&&presentation==='radial'?'<div class="space-root">'+selectBox('rootSelect',opt('','自动选择中心',radialCenter)+data.nodes.map(n=>opt(n.id,n.name,radialCenter)).join(''))+'</div>':'')+
 (view==='graph'?'<div class="graph"><div class="'+(scene?'space-stage':global?'atlas-scroll':'graph-scroll')+'">'+graph+'</div></div>':'<div class="maplist">'+edgeList(active)+'</div>')+
 (scene?'<div class="space-caption"></div>':'')+
 '<div class="panel-foot"><div class="legend"><span><i></i>已使用</span><span><i class="alt"></i>其他状态</span></div>'+
 (view==='graph'?'<div class="zoom"><button class="tiny" data-action="minus" aria-label="缩小">'+icon('minus')+'</button><b>'+Math.round((scene?camera.scale:zoom)*100)+'%</b><button class="tiny" data-action="plus" aria-label="放大">'+icon('plus')+'</button><button class="tiny" data-action="fit" aria-label="重置缩放">'+icon('fit')+'</button></div>':'<span>'+active.length+' 条连线</span>')+'</div>'+
 (multi&&selection.size?'<button class="inspect-link" data-action="inspect">'+textIcon('layers','查看 '+selection.size+' 个节点的对照')+'</button>':global&&focus?'<button class="inspect-link" data-action="inspect">'+textIcon('layers','查看 '+getNode(focus).name+' 的 '+active.length+' 条关系')+'</button>':'')+'</section>'+inspector+'</div>'+
 '<div class="subhead"><h2>流程目录</h2><small>'+available.length+' 个处理域</small></div><div class="flow-grid">'+available.map(flowCard).join('')+'</div>';
 enhanceSelects(screen);
 mountSpace(active);
 mountGraphPan(screen.querySelector('.atlas-scroll,.graph-scroll'));
}
function flowCard(g){const edges=groupEdges(g.id);return '<button class="flow-card '+(group===g.id||layer===g.id?'on':'')+'" data-catalog="'+esc(g.id)+'"><span class="f-icon">'+icon(g.icon)+'</span><span><strong>'+esc(g.name)+'</strong><small>'+uniqueNodes(edges).length+' 个节点 · '+edges.length+' 条连线</small></span>'+icon('right')+'</button>'}
function edgeList(edges){if(!edges.length)return '<p class="empty">此流程暂无连线。</p>';return edges.map(e=>'<button class="edge-line" data-edge="'+esc(e.id)+'"><i>'+icon('route')+'</i><span class="rt"><b>'+esc(getNode(e.from)?.name)+' '+(e.both?'⇄':'→')+' '+esc(getNode(e.to)?.name)+'</b><small>'+esc(e.label)+' · '+esc(channelText(e))+'</small></span><span class="pill">'+esc(e.status)+'</span></button>').join('')}
function detail(edges){
 const n=getNode(selected),rel=edges.filter(e=>e.from===selected||e.to===selected);
 return '<aside class="panel details"><div class="card-head"><span class="card-title">'+textIcon('layers','节点详情')+'</span>'+'</div>'+(n?'<div class="detail-body"><div class="identity"><span class="glyph">'+icon(n.icon)+'</span><div><h3>'+esc(n.name)+'</h3><small>'+esc(n.type)+' · '+esc(n.scope)+'</small></div></div><p>'+esc(n.note||'暂无说明')+'</p><div class="detail-sub">当前流程中的连接<span class="count">'+String(rel.length).padStart(2,'0')+'</span></div><div class="connections">'+rel.map(e=>{const out=e.from===selected,other=getNode(out?e.to:e.from);return '<button class="con" data-edge="'+esc(e.id)+'" title="'+esc(e.label+' · '+channelText(e))+'" aria-label="'+esc('编辑与 '+other.name+' 的连接')+'"><i>'+(e.both?'⇄':out?'→':'←')+'</i>'+esc(other.name)+'<small>'+(e.both?'双向':out?'流出':'流入')+'</small></button>'}).join('')+'</div>'+(group!=='@all'?'<button class="trace" data-trace="'+esc(n.id)+'">'+textIcon('route','跨流程追踪此节点')+'</button>':'')+'</div>':'<p class="empty">选择一个有连线的流程后，可查看节点详情。</p>')+'</aside>';
}
function diagram(nodes,edges){
 if(!nodes.length)return '<p class="empty">此流程暂无连线。</p>';
 const map=new Map(),indeg=new Map(nodes.map(n=>[n.id,0]));for(const e of edges)indeg.set(e.to,indeg.get(e.to)+1);
 const queue=nodes.filter(n=>indeg.get(n.id)===0).map(n=>[n.id,0]);
 while(queue.length){const [id,level]=queue.shift();if(map.has(id))continue;map.set(id,level);for(const e of edges.filter(e=>e.from===id)){indeg.set(e.to,indeg.get(e.to)-1);if(!indeg.get(e.to))queue.push([e.to,Math.min(level+1,5)])}}
 for(const n of nodes)if(!map.has(n.id))map.set(n.id,map.size%3);
 const cols=Array.from({length:Math.max(...map.values())+1},()=>[]);for(const n of nodes)cols[map.get(n.id)].push(n);
 const compact=matchMedia('(max-width:650px)').matches&&cols.every(c=>c.length<=3)&&cols.length<=4;
 const w=compact?380:Math.max(790,cols.length*285),h=compact?cols.length*116+20:Math.max(267,Math.max(...cols.map(c=>c.length))*64+65),nw=compact?Math.min(138,Math.floor((w-24)/Math.max(...cols.map(c=>c.length)))-8):Math.min(170,(w-60)/cols.length-22),nh=48,coords=new Map();
 cols.forEach((col,k)=>{const width=compact?Math.min(173,Math.floor((w-16)/col.length)-8):nw;col.forEach((n,j)=>coords.set(n.id,{width,x:compact?(w-width)/2+(j-(col.length-1)/2)*(width+8):cols.length===1?(w-nw)/2:28+(w-nw-56)*k/(cols.length-1),y:compact?14+k*116:35+(h-46)/2+(j-(col.length-1)/2)*66-nh/2}))});
 const titles=(group==='memory'&&cols.length===3)?['智能体','共享记忆','记忆空间']:cols.map((_,i)=>['输入','处理','输出'][i]||'下游');
 const labels=cols.map((col,k)=>{const p=coords.get(col[0]?.id);return !compact&&p?'<text x="'+(p.x+nw/2)+'" y="25" class="zones" text-anchor="middle">'+titles[k]+'</text>':''}).join('');
 const tags=[];
 const wires=edges.map((e,i)=>{const a=coords.get(e.from),b=coords.get(e.to);const forward=b.x>=a.x,sg=forward?1:-1,sx=a.x+(forward?nw:0),tx=b.x+(forward?0:nw),sy=a.y+nh/2,ty=b.y+nh/2;
 const startX=compact?a.x+a.width/2:sx,endX=compact?b.x+b.width/2:tx,startY=compact?a.y+nh:sy,endY=compact?b.y:ty;
 const bend=Math.max(24,Math.abs(tx-sx)*.55),path=compact?'M '+startX+' '+startY+' C '+startX+' '+(startY+18)+' '+endX+' '+(endY-18)+' '+endX+' '+endY:'M '+sx+' '+sy+' C '+(sx+sg*bend)+' '+sy+' '+(tx-sg*bend)+' '+ty+' '+tx+' '+ty;
 // Place inbound labels closer to the distinct sources; outbound labels nearer their targets.
 const incoming=edges.filter(x=>x.to===e.to).length,outgoing=edges.filter(x=>x.from===e.from).length;
 const t=incoming>1?.32:outgoing>1?.68:.5,u=1-t;
 const c1={x:compact?startX:sx+sg*bend,y:compact?startY+18:sy},c2={x:compact?endX:tx-sg*bend,y:compact?endY-18:ty};
 const px=u*u*u*startX+3*u*u*t*c1.x+3*u*t*t*c2.x+t*t*t*endX,py=u*u*u*startY+3*u*u*t*c1.y+3*u*t*t*c2.y+t*t*t*endY;
 tags.push(channelTag(e,px,py));
 const hot=e.from===selected||e.to===selected;return '<g><title>'+esc(e.label)+' · '+esc(e.status)+'</title><path d="'+path+'" class="wire '+(hot?'hot':'')+'" '+(e.status==='已使用'?'':'stroke-dasharray="5 5"')+' marker-end="url(#tip)" '+(e.both?'marker-start="url(#tip)"':'')+'/>'+(e.status==='已使用'?'<circle r="2" class="packet"><animateMotion path="'+path+'" dur="'+(4+i%3)+'s" begin="-'+(i*.83)+'s" repeatCount="indefinite"/></circle>':'')+'</g>'}).join('');
 const cards=nodes.map(n=>{const p=coords.get(n.id),tight=compact&&p.width<128,sel=multi?selection.has(n.id):n.id===selected,tiles={gpt:['#19382f','#98d8bf'],bot:['#2b2638','#c4a7e4'],core:['#273037','#abcee1'],work:['#282f3b','#acc2eb'],lock:['#302c35','#cbb4d5']},[bg,fg]=sel?['#47301c','#ffac5d']:tiles[n.icon]||['#2c2c2e','#c7c3bf'];
 return '<g class="g-node '+(sel?'chosen':'')+'" data-node="'+esc(n.id)+'" tabindex="0" role="button" aria-pressed="'+sel+'" aria-label="'+esc(n.name)+'" transform="translate('+p.x+' '+p.y+')"><title>'+esc(n.name)+'</title><rect class="nodebox" width="'+p.width+'" height="'+nh+'" rx="8"/><rect x="10" y="9" width="30" height="30" rx="7" fill="'+bg+'"/><svg x="15" y="14" width="20" height="20" viewBox="0 0 24 24" color="'+fg+'" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round">'+(shapes[n.icon]||shapes.grid)+'</svg><text x="48" y="21" class="g-label">'+esc(n.name.length>(tight?8:13)?n.name.slice(0,tight?7:12)+'…':n.name)+'</text><text x="48" y="37" class="g-meta">'+esc(n.type.slice(0,10))+'</text></g>'}).join('');
 return '<svg class="diagram" aria-label="流程关系图" viewBox="0 0 '+w+' '+h+'"><defs><marker id="tip" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="m0 0 8 4-8 4 2-4z" fill="#ca915c"/></marker></defs>'+labels+wires+cards+tags.join('')+'</svg>';
}
function renderRecords(){
 screen.innerHTML='<div class="section-head"><h2>节点管理</h2><div class="heading-controls">'+exportButton+undoButton()+'<button class="btn primary" data-action="new">'+textIcon('plus','新增'+kinds[collection])+'</button></div></div><section class="panel"><div class="toolbar"><div class="seg">'+Object.keys(kinds).map(k=>'<button class="'+(k===collection?'on':'')+'" data-collection="'+k+'">'+kinds[k]+' '+data[k].length+'</button>').join('')+'</div>'+searchControl('query','搜索名称或说明',query)+'</div><div id="rows"></div></section>';renderRows();
}
function renderRows(){
 const rows=data[collection].filter(r=>{const parts=[r.name,r.note,r.type,r.scope,r.label,r.status,r.short,r.channelType,r.channelName];if(collection==='edges')parts.push(getNode(r.from)?.name,getNode(r.to)?.name,getGroup(r.group)?.name);return parts.filter(Boolean).join(' ').toLowerCase().includes(query.toLowerCase())});
 $('#rows').innerHTML=rows.map(r=>{const edge=collection==='edges',g=collection==='groups';return '<button class="record-row" data-record="'+esc(r.id)+'"><span class="glyph">'+icon(r.icon||'route')+'</span><span class="rt"><b>'+esc(edge?getNode(r.from).name+(r.both?' ⇄ ':' → ')+getNode(r.to).name:r.name)+'</b><small>'+esc(edge?r.label+' · '+channelText(r):g?r.short:r.type)+'</small></span><span class="pill">'+esc(edge?r.status:g?data.edges.filter(e=>e.group===r.id).length+' 条连线':r.scope)+'</span>'+icon('edit')+'</button>'}).join('')||'<div class="empty">没有匹配的记录。</div>';
}
function insightSets(){const counts=new Map(data.nodes.map(n=>[n.id,0]));data.edges.forEach(e=>{counts.set(e.from,counts.get(e.from)+1);counts.set(e.to,counts.get(e.to)+1)});return [{id:'verify',name:'待核实的连线',note:'逐条确认信息方向和实际用途，把已经运行的连接标为“已使用”。',items:data.edges.filter(e=>e.status==='待核实'),kind:'edges'},{id:'plans',name:'可推进的流程',note:'查看处于测试或规划中的连线，决定下一步要验证的传递方式。',items:data.edges.filter(e=>['测试中','规划中'].includes(e.status)),kind:'edges'},{id:'isolated',name:'尚未接入的节点',note:'检查没有上游和下游的工具，为仍在使用的产品补上连线。',items:data.nodes.filter(n=>!counts.get(n.id)),kind:'nodes'}]}
function renderInsights(){const sets=insightSets();const shared=data.nodes.filter(n=>new Set(data.edges.filter(e=>e.from===n.id||e.to===n.id).map(e=>e.group)).size>1);sets.push({id:'shared',name:'跨流程复用的工具',note:'这些工具出现在多个流程中。逐个追踪上下游，可检查重复中转或交付环节。',items:shared,kind:'nodes'});const active=sets.find(s=>s.id===insight)||sets[0];screen.innerHTML='<div class="section-head"><h2>优化洞察</h2></div><div class="insight-grid">'+sets.map(s=>'<section class="panel insight"><strong>'+s.items.length+'</strong><h3>'+s.name+'</h3><p>'+s.note+'</p><button class="btn" data-insight="'+s.id+'">查看明细</button></section>').join('')+'</div><div class="subhead"><h2>'+active.name+'</h2><small>按当前图谱计算</small></div><section class="panel">'+(active.items.length?active.kind==='edges'?edgeList(active.items):active.items.map(n=>'<button class="record-row" '+(active.id==='shared'?'data-jump':'data-editnode')+'="'+esc(n.id)+'">'+esc(n.name)+'</button>').join(''):'<p class="empty">当前没有这一类记录。</p>')+'</section>'+connectionOverview()}
function modal(title,body,movable=false){openAtlasDialog(title,body,movable)}
function field(label,name,value,options,max=120){
 let el;if(options)el='<select name="'+name+'">'+options.map(v=>Array.isArray(v)?opt(v[0],v[1],value):opt(v,v,value)).join('')+'</select>';
 else if(name==='note')el='<textarea name="note" maxlength="1500">'+esc(value)+'</textarea>';
 else el='<input name="'+name+'" value="'+esc(value)+'" maxlength="'+max+'" '+(name==='channelName'?'':'required')+'>';
 return '<label>'+esc(label)+el+'</label>';
}
const aiPrompt='读取我的 Flow Atlas 图谱。把我接下来描述的变化整理成节点和有方向的连线。先核对已有 ID，保留无关记录，依据最新 revision 保存，再读回并说明改动。';
function aiPanel(){modal('AI 维护','<div class="ai-copy"><p>让已连接 Flow Atlas 插件的助手读取和更新这张图。手动编辑与 AI 使用同一份数据。</p><h3>给助手的指令</h3><div class="snippet">'+esc(aiPrompt)+'</div><div class="actions"><button class="btn" data-action="copy">复制指令</button></div><h3>连接与维护说明</h3><p>在 ChatGPT 或 Codex 的插件列表中找到 Flow Atlas，安装并连接后，即可让助手维护图谱。</p><div class="linkrow"><a class="btn btnlink" href="/SKILL.md" download="SKILL.md">'+textIcon('download','下载维护 Skill')+'</a></div></div>')}

function pickNode(id){if(selection.has(id))selection.delete(id);else selection.add(id);renderMap()}
document.addEventListener('change',e=>{if(e.target.id==='rootSelect'){radialCenter=e.target.value;renderMap();return}if(e.target.id==='layerSelect'){focusedDomain='';layer=e.target.value;focus='';zoom=1;renderMap()}if(e.target.id==='focusSelect'){focusedDomain='';if(multi){if(e.target.value)pickNode(e.target.value);return}focus=e.target.value;selected=focus;zoom=focus?1.6:1;renderMap();if(focus&&presentation==='flat')centerStation(focus)}if(e.target.id==='groupSelect')chooseGroup(e.target.value)});
document.addEventListener('input',e=>{if(e.target.id==='query'){query=e.target.value;renderRows()}});
function chooseGroup(id){flatOffset={x:0,y:0};focusedDomain='';layer='';focus='';group=id;view='graph';selected='';zoom=1;renderMap();$('.workspace')?.scrollIntoView({block:'nearest',behavior:matchMedia('(prefers-reduced-motion:reduce)').matches?'instant':'smooth'})}
document.addEventListener('click',async e=>{
 const b=e.target.closest('button,[data-node],[data-edge]');if(!b)return;
 if(b.id==='ai'){if(!editorIsOpen())aiPanel();return}if(!data&&b.dataset.action!=='retry'&&b.dataset.action!=='close')return;
 const d=b.dataset;
 if(d.tab){expanded=false;syncTab(d.tab)}
 else if(d.scope){focus='';scope=d.scope;zoom=1;renderMap()}
 else if(d.group)chooseGroup(d.group);
 else if(d.catalog)chooseGroup(d.catalog);
 else if(d.jump){focusedDomain='';layer='';group='@all';scope='全部';selected=focus=d.jump;zoom=1;syncTab('map')}
 else if(d.trace){focusedDomain='';layer='';group='@all';focus=d.trace;selected=d.trace;zoom=1;renderMap()}
 else if(d.presentation){presentation=d.presentation;view='graph';camera={...initialCamera};zoom=1;renderMap();screen.querySelector('[data-presentation="'+presentation+'"]')?.focus({preventScroll:true})}
 else if(d.action==='multi'){multi=!multi;if(multi&&(group==='@all'?focus:selected))selection.add(group==='@all'?focus:selected);if(!multi)selection.clear();focus='';renderMap();screen.querySelector('[data-action=multi]')?.focus({preventScroll:true})}
 else if(d.action==='clear-picks'){selection.clear();renderMap()}
 else if(d.remove)pickNode(d.remove);
 else if(d.action==='relayout'){view='graph';arrangement++;zoom=1;flatOffset={x:0,y:0};camera={...initialCamera};renderMap();toast('已重新计算布局')}
 else if(d.node){focusedDomain=d.domain||'';if(multi||e.ctrlKey||e.metaKey||e.shiftKey){if(!multi&&(group==='@all'?focus:selected))selection.add(group==='@all'?focus:selected);multi=true;focus='';pickNode(d.node);return}selected=d.node;if(group==='@all'){focus=d.node;if(layer&&!memberships(focus).some(g=>g.id===layer))layer='';zoom=Math.max(zoom,1.6)}renderMap();if(group==='@all'&&presentation==='flat')centerStation(d.node)}
 else if(d.layer){layer=d.layer==='@all'?'':d.layer;focus='';renderMap()}
 else if(d.action==='clear-all'){layer='';focus='';renderMap()}
 else if(d.action==='clear-node'){focus='';renderMap()}
 else if(d.action==='expand'){expanded=!expanded;renderMap();screen.querySelector('[data-action=expand]')?.focus({preventScroll:true})}
 else if(d.action==='space-pan'){spacePan=!spacePan;renderMap();screen.querySelector('[data-action=space-pan]')?.focus({preventScroll:true})}
 else if(d.action==='inspect'){document.querySelector('.atlas-side')?.scrollIntoView({block:'center'})}
 else if(d.newKind)edit(d.newKind);
 else if(d.editflow)edit('groups',d.editflow);
 else if(d.action==='undo'){if(!editorIsOpen())write({action:'undo',collection:'nodes',revision:data.revision})}
 else if(d.connect)edit('edges',null,d.connect,d.sourceLayer);
 else if(d.editnode)edit('nodes',d.editnode);
 else if(d.edge)edit('edges',d.edge);
 else if(d.insight){insight=d.insight;renderInsights()}
 else if(d.collection){collection=d.collection;query='';renderRecords()}
 else if(d.record)edit(collection,d.record);
 else if(d.action==='new')edit(collection);
 else if(d.action==='close')dlg.close();
 else if(d.action==='mode'){view=view==='graph'?'list':'graph';renderMap()}
 else if(['plus','minus','fit'].includes(d.action)){
  const next=d.action==='fit'?1:zoom+(d.action==='plus'?.25:-.25);
  if(group==='@all'&&presentation!=='flat'){if(d.action==='fit')camera={...initialCamera};else camera.scale=clampZoom(camera.scale+(d.action==='plus'?.25:-.25));paintSpace()}else if(d.action==='fit'){flatOffset={x:0,y:0};zoom=1;paintFlat()}else zoomAtlas(next)
 }
 else if(d.action==='delete')removePrompt();
 else if(d.action==='cancel-delete'){b.closest('.delete-confirmation').remove();$('#form').hidden=false;dlg.querySelector('[data-action=delete]').focus()}
 else if(d.action==='delete-ok')write({action:'delete',collection:editing.kind,id:editing.record.id,revision:editing.revision});
 else if(d.action==='copy'){try{await navigator.clipboard.writeText(aiPrompt);b.textContent='已复制'}catch{b.textContent='请选中上方文字复制'}}
 else if(d.action==='retry')start();
});
document.addEventListener('keydown',e=>{if((e.key==='Enter'||e.key===' ')&&e.target.matches('g[data-node],g[data-edge]')){e.preventDefault();e.target.dispatchEvent(new MouseEvent('click',{bubbles:true,shiftKey:e.shiftKey,ctrlKey:e.ctrlKey,metaKey:e.metaKey}));if(e.target.dataset.node)document.querySelector('g[data-node="'+CSS.escape(e.target.dataset.node)+'"]')?.focus({preventScroll:true})}});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&expanded&&!dlg.open&&!picker.open){expanded=false;renderMap()}});
window.addEventListener('hashchange',()=>{if(data)syncTab(['records','insights'].includes(location.hash.slice(1))?location.hash.slice(1):'map')});
document.addEventListener('visibilitychange',()=>{if(data&&!document.hidden&&!dlg.open&&!picker.open)fetchData().then(render).catch(()=>{})});
async function start(){try{await fetchData();render()}catch(e){screen.innerHTML='<div class="empty">'+esc(e.message)+' <button class="btn" data-action="retry">重新读取</button></div>'}}
start();

matchMedia('(max-width:650px)').addEventListener('change',()=>{if(data&&tab==='map')renderMap()});
