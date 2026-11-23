const channelText=e=>[e.channelType,e.channelName].filter(Boolean).join(' · ')||'待补通道';
function channelTag(edge,x,y,small=false){
 const type=edge.channelType|| (edge.channelName?'数据通道':'待补通道');
 const name=edge.channelName||'';
 const size=small?6.8:10.5,line=small?8:12;
 const measure=s=>Array.from(s).reduce((w,c)=>w+(/[^\x00-\x7f]/.test(c)?1:.59),0)*size;
 const title=type.length>16?type.slice(0,15)+'…':type;
 const caption=name.length>19?name.slice(0,18)+'…':name;
 const w=Math.max(measure(title),measure(caption))+size*1.4,h=caption?line*2+4:line+5;
 return '<g class="channel-tag '+(edge.channelType||name?'known':'unknown')+'" data-edge="'+esc(edge.id)+'" tabindex="0" role="button" aria-label="'+esc('编辑通道 '+getNode(edge.from).name+' 与 '+getNode(edge.to).name+' · '+channelText(edge))+'" transform="translate('+x+' '+y+')"><title>'+esc(edge.label+' · '+channelText(edge))+'</title><rect x="'+(-w/2)+'" y="'+(-h/2)+'" width="'+w+'" height="'+h+'" rx="'+(small?3:5)+'"/><text text-anchor="middle" y="'+(caption?-line*.18:size*.34)+'" style="font-size:'+size+'px">'+esc(title)+'</text>'+(caption?'<text class="channel-name" text-anchor="middle" y="'+(line*.8)+'" style="font-size:'+size+'px">'+esc(caption)+'</text>':'')+'</g>';
}
const clampZoom=value=>Math.max(.65,Math.min(4,value));
let flatOffset={x:0,y:0}, flatCanvas;

function paintFlat(){
 if(!flatCanvas?.svg.isConnected)return;
 const {svg,width,height}=flatCanvas;
 const w=width/zoom,h=height/zoom;
 flatOffset.x=Math.max(-width*.68,Math.min(width*.68,flatOffset.x));
 flatOffset.y=Math.max(-height*.68,Math.min(height*.68,flatOffset.y));
 svg.setAttribute('viewBox',[(width-w)/2+flatOffset.x,(height-h)/2+flatOffset.y,w,h].join(' '));
 svg.classList.toggle('deep',zoom>=1.4);
 const indicator=screen.querySelector('.zoom b');if(indicator)indicator.textContent=Math.round(100*zoom)+'%';
}
function flatPoint(x,y){
 const {svg}=flatCanvas,transform=svg.getScreenCTM();
 return new DOMPoint(x,y).matrixTransform(transform.inverse());
}
function centerStation(id){
 const node=flatCanvas?.svg.querySelector('[data-node="'+CSS.escape(id)+'"]');
 if(!node)return;
 const box=node.getBoundingClientRect(),point=flatPoint(box.left+box.width/2,box.top+box.height/2);
 flatOffset={x:point.x-flatCanvas.width/2,y:point.y-flatCanvas.height/2};paintFlat();
}
function zoomAtlas(value,clientX,clientY){
 if(!flatCanvas?.svg.isConnected)return;
 const before=clientX===undefined?null:flatPoint(clientX,clientY);
 zoom=clampZoom(value);paintFlat();
 if(!before)return;
 const after=flatPoint(clientX,clientY);
 flatOffset.x+=before.x-after.x;flatOffset.y+=before.y-after.y;paintFlat();
}
function mountGraphPan(port){
 const svg=port?.querySelector('svg.atlas-svg,svg.diagram');
 flatCanvas=null;
 if(!svg)return;
 const [, ,width,height]=svg.getAttribute('viewBox').split(/\s+/).map(Number);
 flatCanvas={svg,width,height};
 if(svg.classList.contains('atlas-svg'))port.style.aspectRatio=width+' / '+height;
 paintFlat();
 const pointers=new Map();
 let moved=false,position=null;
 const sample=()=>{
  const [first,second]=pointers.values();
  if(!second)return {...first,span:0};
  return {x:(first.x+second.x)/2,y:(first.y+second.y)/2,span:Math.hypot(first.x-second.x,first.y-second.y)};
 };
 port.addEventListener('pointerdown',e=>{
  if(e.button!==0||pointers.size>=2)return;
  pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
  position=sample();
  if(pointers.size===1)moved=false;
 });
 port.addEventListener('pointermove',e=>{
  if(!pointers.has(e.pointerId))return;
  pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
  const next=sample();
  if(!moved&&pointers.size===1&&Math.hypot(next.x-position.x,next.y-position.y)<5)return;
  moved=true;port.classList.add('dragging');
  for(const id of pointers.keys())if(!port.hasPointerCapture(id))port.setPointerCapture(id);
  const before=flatPoint(position.x,position.y);
  if(next.span&&position.span)zoom=clampZoom(zoom*next.span/position.span);
  paintFlat();
  const after=flatPoint(next.x,next.y);
  flatOffset.x+=before.x-after.x;flatOffset.y+=before.y-after.y;
  paintFlat();position=next;
 });
 function release(e){
  pointers.delete(e.pointerId);position=pointers.size?sample():null;
  if(!position)port.classList.remove('dragging');
 }
 for(const event of ['pointerup','pointercancel','lostpointercapture'])port.addEventListener(event,release);
 port.addEventListener('pointerleave',e=>{if(!port.hasPointerCapture(e.pointerId))release(e)});
 port.addEventListener('click',e=>{if(moved){e.stopPropagation();moved=false}},true);
 port.addEventListener('wheel',e=>{
  if(!e.deltaY)return;
  e.preventDefault();zoomAtlas(zoom*Math.exp(-Math.max(-120,Math.min(120,e.deltaY))*.0024),e.clientX,e.clientY);
 },{passive:false});
}
