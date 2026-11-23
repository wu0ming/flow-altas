'use strict';

function searchControl(id,label,value=''){
 return '<div class="search-control"><span class="search-icon">'+icon('search')+'</span>'+
 '<input id="'+esc(id)+'" type="search" aria-label="'+esc(label)+'" placeholder="'+esc(label)+'" value="'+esc(value)+'">'+
 '<button type="button" class="search-clear" aria-label="清除搜索">'+icon('x')+'</button></div>';
}

document.addEventListener('click',event=>{
 const clear=event.target.closest('.search-clear');
 if(!clear)return;
 const input=clear.previousElementSibling;
 input.value='';input.dispatchEvent(new Event('input',{bubbles:true}));input.focus();
});

function openAtlasDialog(title,body,movable=false){
 const floating=dlg.open&&dlg.classList.contains('floating');
 if(!dlg.open){
  dlg.classList.remove('floating');
  dlg.style.removeProperty('--dialog-left');
  dlg.style.removeProperty('--dialog-top');
 }
 dlg.classList.toggle('movable',movable);
 $('#modal').innerHTML='<div class="dialog-title"><h2 id="atlas-dialog-title">'+esc(title)+'</h2>'+
  (movable?'<button type="button" class="dialog-grip" aria-label="拖动编辑卡片，点击解除模糊，也可用方向键移动" title="拖动移开卡片 · 点击解除背景模糊"><svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor" aria-hidden="true"><circle cx="5" cy="3" r="1"/><circle cx="11" cy="3" r="1"/><circle cx="5" cy="8" r="1"/><circle cx="11" cy="8" r="1"/><circle cx="5" cy="13" r="1"/><circle cx="11" cy="13" r="1"/></svg></button>':'')+
  '<button type="button" class="plain-icon" data-action="close" aria-label="关闭">'+icon('x')+'</button></div>'+body;
 enhanceSelects(dlg);
 if(!dlg.open)dlg.showModal();
 else if(floating)clampEditorPosition();
}
function clampEditorPosition(left,top){
 const rect=dlg.getBoundingClientRect();
 const x=Math.max(8,Math.min(innerWidth-rect.width-8,left??rect.left));
 const y=Math.max(8,Math.min(innerHeight-rect.height-8,top??rect.top));
 dlg.style.setProperty('--dialog-left',x+'px');
 dlg.style.setProperty('--dialog-top',y+'px');
}
function floatEditor(){
 if(dlg.classList.contains('floating'))return;
 const rect=dlg.getBoundingClientRect(),scroll=dlg.scrollTop,focused=document.activeElement;
 dlg.close();dlg.classList.add('floating');
 dlg.style.setProperty('--dialog-left',rect.left+'px');
 dlg.style.setProperty('--dialog-top',rect.top+'px');
 dlg.show();
 clampEditorPosition(rect.left,rect.top);dlg.scrollTop=scroll;
 if(dlg.contains(focused))focused.focus({preventScroll:true});
}
function editorIsOpen(){
 if(!dlg.open||!dlg.classList.contains('floating'))return false;
 dlg.querySelector('.dialog-grip')?.focus({preventScroll:true});
 toast('请先保存或关闭当前编辑卡片');
 return true;
}

function bindEditorMovement(){
 const dialog=document.querySelector('#dialog');
 let drag=null,ignoreClick=false;
 dialog.addEventListener('pointerdown',event=>{
  if(event.button!==0||!dialog.classList.contains('movable'))return;
  const handle=event.target.closest('.dialog-title');
  if(!handle||event.target.closest('button:not(.dialog-grip)'))return;
  const {left,top}=dialog.getBoundingClientRect();
  drag={id:event.pointerId,x:event.clientX,y:event.clientY,left,top,moved:false};
  ignoreClick=false;
 });
 dialog.addEventListener('pointermove',event=>{
  if(drag?.id!==event.pointerId)return;
  const dx=event.clientX-drag.x,dy=event.clientY-drag.y;
  if(!drag.moved&&Math.hypot(dx,dy)<4)return;
  drag.moved=true;floatEditor();
  if(!dialog.hasPointerCapture(event.pointerId))dialog.setPointerCapture(event.pointerId);
  clampEditorPosition(drag.left+dx,drag.top+dy);
 });
 for(const type of ['pointerup','pointercancel','lostpointercapture'])dialog.addEventListener(type,event=>{
  if(drag?.id!==event.pointerId)return;
  ignoreClick=drag.moved;drag=null;
 });
 dialog.addEventListener('click',event=>{
  if(!event.target.closest('.dialog-grip')&&!(event.target===dialog&&ignoreClick))return;
  if(!ignoreClick)floatEditor();
  ignoreClick=false;
 });
 dialog.addEventListener('keydown',event=>{
  if(event.key==='Escape'&&dialog.classList.contains('floating')&&!picker.open&&!submitting){
   event.preventDefault();event.stopPropagation();dialog.close();return;
  }
  if(!event.target.closest('.dialog-grip'))return;
  const delta={ArrowLeft:[-20,0],ArrowRight:[20,0],ArrowUp:[0,-20],ArrowDown:[0,20]}[event.key];
  if(!delta)return;
  event.preventDefault();floatEditor();
  const {left,top}=dialog.getBoundingClientRect();
  clampEditorPosition(left+delta[0],top+delta[1]);
 });
 window.addEventListener('resize',()=>{if(dialog.open&&dialog.classList.contains('floating'))clampEditorPosition()});
}
bindEditorMovement();
