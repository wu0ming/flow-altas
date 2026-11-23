'use strict';

let editing;
const nodeIcons={grid:'通用',route:'流程',stack:'记忆中枢',layers:'分层',gpt:'ChatGPT',bot:'智能体',core:'核心',work:'工作',lock:'隐私',book:'知识库',lark:'飞书',notion:'Notion',gem:'笔记',box:'文件',mail:'邮件',drive:'云盘',send:'剪藏',code:'开发',spark:'AI',net:'图谱'};
const edgeChannels=['插件','MCP','飞书官方接口','飞书应用接口','API','文件传输','手动传递','其他'];
const editorScopes=['通用','工作','生活'];

function undoButton(){
 return data.canUndo?'<button type="button" class="btn" data-action="undo" title="撤销最近一次成功的图谱修改">撤销上一步</button>':'';
}
function graphEditor(source,domain,flow){
 const selectedTools=source?'<button class="btn connect-btn" data-connect="'+esc(source)+'" data-source-layer="'+esc(domain)+'">'+textIcon('plus','添加连接')+'</button><button class="btn" data-editnode="'+esc(source)+'">'+textIcon('edit','编辑节点')+'</button>':'<button class="btn" data-new-kind="edges">'+textIcon('link','新建连线')+'</button>';
 const flowTool=flow?'<button class="btn" data-editflow="'+esc(flow.id)+'">'+textIcon('edit','编辑流程')+'</button>':'<button class="btn" data-new-kind="groups">'+textIcon('layers','新建流程')+'</button>';
 return '<div class="graph-edit-tools" role="group" aria-label="图谱编辑"><button class="btn primary" data-new-kind="nodes">'+textIcon('plus','新建节点')+'</button>'+selectedTools+'<div class="flow-edit-tools">'+flowTool+undoButton()+'</div></div>';
}
function edgeFields(record,flows,newNode=false){
 const domains=[['','跟随所属流程'],...flows], channels=[...edgeChannels];
 if(record.channelType&&!channels.includes(record.channelType))channels.push(record.channelType);
 const direction=newNode?field('连接方向','direction','out',[['out','新节点 → 已有节点'],['in','已有节点 → 新节点'],['both','双向 ⇄']]):field('方向','both',String(record.both),[['false','单向 →'],['true','双向 ⇄']]);
 return '<div class="form-pair">'+field('所属流程','group',record.group,flows)+direction+'</div>'+
  field('传递什么信息','label',record.label)+
  '<div class="form-pair">'+field('数据通道类型','channelType',record.channelType||'',[['','待补充'],...channels])+field('通道名称（可选）','channelName',record.channelName||'')+'</div>'+
  '<details class="advanced-edge" '+(record.fromDomain||record.toDomain?'open':'')+'><summary>'+icon('chev')+' 更多连接设置</summary><div class="form-pair">'+
  field('起点所在层','fromDomain',record.fromDomain||'',domains)+field('终点所在层','toDomain',record.toDomain||'',domains)+
  field('连接场景',newNode?'edgeScope':'scope',record.scope,editorScopes)+field('状态','status',record.status,['已使用','测试中','规划中','待核实'])+
  '</div></details>';
}
function connectionTargets(source,initial=[],caption='目标节点'){
 const targets=data.nodes.filter(n=>n.id!==source);
 return '<fieldset class="target-picker"><legend>'+esc(caption)+' <span id="target-count">已选 '+initial.length+' 个</span></legend>'+
 searchControl('target-search','搜索目标节点')+'<div class="target-options">'+
 targets.map(n=>'<label data-target-choice><input type="checkbox" name="targets" value="'+esc(n.id)+'" '+(initial.includes(n.id)?'checked':'')+'><span>'+esc(n.name)+'</span><small>'+esc(n.type)+'</small></label>').join('')+
 '<p id="target-empty" hidden>没有匹配的节点。</p></div></fieldset><p class="target-note">以下设置会应用于本次选中的所有连接。</p>';
}
function edit(kind,id,source,sourceDomain){
 if(editorIsOpen())return;
 const existing=data[kind].find(item=>item.id===id),connecting=Boolean(source);
 const nodes=data.nodes.map(n=>[n.id,n.name]),flows=data.groups.map(g=>[g.id,g.name]);
 const defaultFlow=getGroup(group)?.id||getGroup(sourceDomain)?.id||getGroup(layer)?.id||(source&&memberships(source)[0]?.id)||data.groups[0]?.id;
 const record=existing||{id:'id-'+crypto.randomUUID(),name:'',scope:'通用',note:'',icon:kind==='groups'?'route':'grid',type:'工具',group:defaultFlow,status:'待核实',short:'',label:'',from:source||data.nodes[0]?.id,to:data.nodes[1]?.id,both:false,fromDomain:sourceDomain||''};
 const availableIcons=Object.entries(nodeIcons);
 if(!Object.hasOwn(nodeIcons,record.icon))availableIcons.push([record.icon,record.icon]);
 editing={kind,record,connecting,existing:Boolean(existing),revision:data.revision};
 let content='';
 if(kind==='edges'){
  if(nodes.length<2||!flows.length){modal('还需补充记录','<p class="note-line">创建连线前，需要至少两个节点和一个流程。</p>');return}
  content=connecting?'<div class="connect-source"><span>起点</span><strong>'+esc(getNode(source).name)+'</strong></div>'+connectionTargets(source):'<div class="form-pair">'+field('起点','from',record.from,nodes)+field('终点','to',record.to,nodes)+'</div>';
  content+=edgeFields(record,flows);
 }else{
  content=field('名称','name',record.name,null,60);
  if(kind==='nodes'){
   content+='<div class="form-pair">'+field('节点类型','type',record.type,null,30)+field('使用场景','scope',record.scope,editorScopes)+'</div>'+field('节点说明','note',record.note);
  }else content+=field('流程分类','short',record.short,null,30);
  content+=field('图标','icon',record.icon,availableIcons);
 }
 if(kind==='nodes'&&!existing&&flows.length&&nodes.length){
  const prior=tab==='map'?(multi?[...selection]:[group==='@all'?focus:selected]).filter(Boolean):[];
  const defaults={...record,scope:scope==='全部'?'通用':scope};
  content+='<label class="optional-connect"><input type="checkbox" name="connectNow"> 同时连接已有节点</label><fieldset id="new-connections" class="new-connections" hidden disabled>'+connectionTargets('',prior,'已有节点')+edgeFields(defaults,flows,true)+'</fieldset>';
 }
 const title=connecting?'添加连接':(existing?'编辑':'新建')+kinds[kind];
 modal(title,'<form id="form" class="form">'+content+'<div class="error" role="alert"></div><div class="actions">'+
 (existing?'<button type="button" data-action="delete" class="btn danger">删除</button>':'')+
 '<button type="button" data-action="close" class="btn">取消</button><button type="submit" class="btn primary">保存</button></div></form>',true);
 if(!existing&&!connecting&&kind!=='edges')dlg.querySelector('[name=name]')?.focus({preventScroll:true});
}
function focusCreatedNode(id){
 if(tab!=='map')return;
 group='@all';layer='';focusedDomain='';scope='全部';focus=selected=id;
 multi=false;selection.clear();view='graph';zoom=1;flatOffset={x:0,y:0};camera={...initialCamera};
}
async function write(op){
 if(submitting)return;
 submitting=true;
 const controls=[...dlg.querySelectorAll('button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled)')];
 controls.forEach(control=>control.disabled=true);
 try{
  const response=await fetch('/api/atlas',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(op)});
  const value=await response.json();
  if(!response.ok){
   if(response.status===409&&op.action==='undo'){await fetchData();render()}
   throw Error(value.error||'保存失败，请重试');
  }
  data=value;if(dlg.open)dlg.close();
  if(op.action==='create-node')focusCreatedNode(op.record.id);
  render();
  if(op.action==='create-node'&&tab==='map'){
   if(presentation==='flat')centerStation(op.record.id);
   else centerSpatialNode(op.record.id);
  }
  const message=op.action==='connect'?'已添加 '+op.records.length+' 条连接':
   op.action==='create-node'?(op.records.length?'已新建节点并添加 '+op.records.length+' 条连接':'已新建节点'):
   op.action==='delete'?'已删除，可撤销上一步':op.action==='undo'?'已撤销上一步':'图谱已更新';
  toast(message);
 }catch(error){
  const message=dlg.open&&dlg.querySelector('.delete-confirmation .error, #form:not([hidden]) .error');
  if(message)message.textContent=error.message;else toast(error.message);
 }finally{submitting=false;controls.forEach(control=>control.disabled=false)}
}
function removePrompt(){
 const {kind,record}=editing,form=dlg.querySelector('#form');
 const related=kind==='nodes'?data.edges.filter(e=>e.from===record.id||e.to===record.id):[];
 const preview=related.slice(0,5).map(e=>'<li>'+esc(getNode(e.from).name+(e.both?' ⇄ ':' → ')+getNode(e.to).name)+'</li>').join('');
 form.hidden=true;
 const prompt=document.createElement('section');prompt.className='delete-confirmation';
 prompt.innerHTML='<p class="note-line">删除「'+esc(record.name||record.label)+'」'+(related.length?'将同时移除 '+related.length+' 条关联连线':'将从图谱移除此记录')+'。可用「撤销上一步」恢复。</p>'+
 (related.length?'<ul>'+preview+(related.length>5?'<li>另有 '+(related.length-5)+' 条</li>':'')+'</ul>':'')+
 '<div class="error" role="alert"></div><div class="actions"><button type="button" class="btn" data-action="cancel-delete">返回编辑</button><button type="button" class="btn danger" data-action="delete-ok">确认删除</button></div>';
 form.after(prompt);prompt.querySelector('[data-action=cancel-delete]').focus();
}
document.addEventListener('submit',event=>{
 const form=event.target;
 if(form.id!=='form')return;
 event.preventDefault();
 const {record,kind,revision,connecting,existing}=editing;
 const values=new FormData(form),fields=Object.fromEntries(values),targets=values.getAll('targets');
 if((connecting||fields.connectNow)&&!targets.length){
  form.querySelector('.error').textContent='请选择至少一个已有节点';return;
 }
 if(kind==='nodes'&&!existing){
  const node={id:record.id,...Object.fromEntries(['name','type','scope','note','icon'].map(key=>[key,fields[key]]))};
  const direction=fields.direction||'out';
  const records=fields.connectNow?targets.map(id=>({
   id:'id-'+crypto.randomUUID(),from:direction==='in'?id:node.id,to:direction==='in'?node.id:id,both:direction==='both',
   group:fields.group,fromDomain:fields.fromDomain,toDomain:fields.toDomain,label:fields.label,
   channelType:fields.channelType,channelName:fields.channelName,scope:fields.edgeScope,status:fields.status
  })):[];
  write({collection:kind,action:'create-node',revision,record:node,records,direction});return;
 }
 if(kind==='edges')fields.both=fields.both==='true';
 if(connecting){
  delete fields.targets;
  const records=targets.map(to=>({...record,...fields,id:'id-'+crypto.randomUUID(),to}));
  write({collection:'edges',action:'connect',revision,records});return;
 }
 write({collection:kind,action:'save',revision,record:{...record,...fields}});
});
document.addEventListener('change',event=>{
 const input=event.target;
 if(input.name==='connectNow'){
  const section=$('#new-connections');section.hidden=section.disabled=!input.checked;
 }else if(input.name==='targets'){
  const count=input.form.querySelectorAll('input[name=targets]:checked').length;
  $('#target-count').textContent='已选 '+count+' 个';
 }
});
document.addEventListener('input',event=>{
 if(event.target.id!=='target-search')return;
 const query=event.target.value.trim().toLowerCase();let matches=0;
 for(const row of dlg.querySelectorAll('[data-target-choice]')){
  row.hidden=!row.textContent.toLowerCase().includes(query);
  if(!row.hidden)matches++;
 }
 $('#target-empty').hidden=matches>0;
});
document.addEventListener('cancel',event=>{
 if(event.target===dlg&&submitting)event.preventDefault();
},true);
