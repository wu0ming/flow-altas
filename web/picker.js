// Keep the original select as the form value. The visible trigger always opens
// a themed dialog, including inside the edit dialog on Android.
const picker=document.createElement('dialog');
picker.className='atlas-picker';
picker.setAttribute('aria-labelledby','picker-title');
document.body.append(picker);
let picking=null,pickerTrigger=null;
function enhanceSelects(root=document){
 for(const select of root.querySelectorAll('select:not([data-enhanced])')){
  select.dataset.enhanced='true';select.hidden=true;
  const label=select.getAttribute('aria-label')||select.parentElement.firstChild.textContent.trim();
  const trigger=document.createElement('button');trigger.type='button';trigger.className='picker-trigger';
  trigger.setAttribute('aria-haspopup','dialog');trigger.setAttribute('aria-expanded','false');
  const value=select.selectedOptions[0]?.textContent||'请选择';
  trigger.setAttribute('aria-label',label+' · '+value);
  trigger.innerHTML='<span>'+esc(value)+'</span>'+icon('chev');
  trigger.addEventListener('click',ev=>{ev.preventDefault();openPicker(select,trigger,label)});
  select.after(trigger);
 }
}
function openPicker(select,trigger,label){
 picking=select;pickerTrigger=trigger;trigger.setAttribute('aria-expanded','true');
 picker.innerHTML='<div class="sheet-grip"></div><div class="picker-heading"><h2 id="picker-title">'+esc(label)+'</h2><button type="button" class="plain-icon" data-pclose aria-label="关闭菜单">'+icon('x')+'</button></div>'+
 (select.options.length>10?searchControl('picker-query','搜索选项'):'')+'<div class="picker-options" role="listbox" aria-label="'+esc(label)+'"></div>';
 fillPicker('');
 picker.showModal();
 if(!matchMedia('(max-width:650px)').matches){
  const rect=trigger.getBoundingClientRect(),height=picker.getBoundingClientRect().height;
  picker.style.left=Math.max(10,Math.min(rect.left,innerWidth-picker.offsetWidth-10))+'px';
  picker.style.top=Math.max(8,rect.bottom+height+10<innerHeight?rect.bottom+6:rect.top-height-6)+'px';
 }
 const current=picker.querySelector('[aria-selected=true]')||picker.querySelector('[role=option]');
 current?.focus({preventScroll:true});current?.scrollIntoView({block:'nearest'});
}
function fillPicker(q){
 const choices=Array.from(picking.options).filter(o=>o.textContent.toLowerCase().includes(q.trim().toLowerCase()));
 picker.querySelector('.picker-options').innerHTML=choices.map(o=>{
  const g=['groupSelect','layerSelect'].includes(picking.id)?getGroup(o.value):null;
  return '<button type="button" role="option" aria-selected="'+o.selected+'" data-value="'+esc(o.value)+'">'+(g?'<i class="swatch" style="--ink:'+layerColor(g.id)+'"></i>':'')+'<span>'+esc(o.textContent)+'</span>'+(o.selected?'<span class="check" aria-hidden="true">✓</span>':'')+'</button>';
 }).join('')||'<p class="empty">没有匹配的选项</p>';
}
picker.addEventListener('input',e=>{if(e.target.matches('input'))fillPicker(e.target.value)});
picker.addEventListener('click',e=>{
 const option=e.target.closest('[role=option]');
 if(option){
  const select=picking;select.value=option.dataset.value;
  pickerTrigger.querySelector('span').textContent=option.textContent.replace(/✓$/,'');
  pickerTrigger.setAttribute('aria-label',picker.querySelector('h2').textContent+' · '+select.selectedOptions[0].textContent);
  picker.close();select.dispatchEvent(new Event('change',{bubbles:true}));return;
 }
 if(e.target.closest('[data-pclose]')||e.target===picker)picker.close();
});
picker.addEventListener('keydown',e=>{
 if(!['ArrowDown','ArrowUp','Home','End'].includes(e.key))return;
 const choices=Array.from(picker.querySelectorAll('[role=option]'));if(!choices.length)return;
 let i=choices.indexOf(document.activeElement);
 i=e.key==='Home'?0:e.key==='End'?choices.length-1:(i+(e.key==='ArrowDown'?1:-1)+choices.length)%choices.length;
 e.preventDefault();choices[i].focus();
});
picker.addEventListener('close',()=>{picker.removeAttribute('style');pickerTrigger?.setAttribute('aria-expanded','false');if(pickerTrigger?.isConnected)pickerTrigger.focus({preventScroll:true});else if(picking?.id)document.getElementById(picking.id)?.nextElementSibling?.focus({preventScroll:true});picking=null;pickerTrigger=null});
