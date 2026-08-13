// My Workboard V4 - integrated inline tasks

const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const uid=()=>crypto.randomUUID?crypto.randomUUID():Date.now().toString(36)+Math.random().toString(36).slice(2);
const todayISO=()=>new Date().toISOString().slice(0,10);
const esc=s=>(s??'').toString().replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
const fmtDate=d=>new Intl.DateTimeFormat('zh-CN',{year:'numeric',month:'long',day:'numeric',weekday:'short'}).format(new Date(d+'T12:00:00'));
const fmtTime=ts=>ts?new Intl.DateTimeFormat('zh-CN',{hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false}).format(new Date(ts)):'-';
const msToText=ms=>{if(!ms||ms<0)return'-';const s=Math.floor(ms/1000),h=Math.floor(s/3600),m=Math.floor((s%3600)/60),ss=s%60;return[h?`${h}h`:null,m?`${m}m`:null,`${ss}s`].filter(Boolean).join(' ')};
const tagHtml=tags=>(tags||[]).map(t=>`<span class="tag">${esc(t)}</span>`).join('');
const splitTags=s=>s.split(/[,，\s]+/).map(x=>x.trim()).filter(Boolean);

const DEFAULT={
 routines:[
  {id:uid(),name:'Mail Check',repeat:'weekdays',weekdays:[1,2,3,4,5],subtasks:[{id:uid(),title:'确认 Inbox'},{id:uid(),title:'确认需要跟进的邮件'}]},
  {id:uid(),name:'JP1 Check',repeat:'weekdays',weekdays:[1,2,3,4,5],subtasks:[]},
  {id:uid(),name:'IDMC Check',repeat:'weekdays',weekdays:[1,2,3,4,5],subtasks:[]}
 ],
 routineLogs:{},
 kanbanColumns:[{id:'todo',name:'TODO'},{id:'doing',name:'DOING'},{id:'waiting',name:'WAITING'},{id:'done',name:'DONE'}],
 kanban:[{id:uid(),title:'确认 AMO 回复',status:'todo',html:'',checks:[],images:[],tags:['AMO']},{id:uid(),title:'更新手顺书',status:'doing',html:'',checks:[],images:[],tags:['文档']}],
 memos:[{id:uid(),title:'Quick Memo',html:'可以在这里记录临时 Memo、链接、截图和 checkbox。',checks:[],images:[],tags:[],updatedAt:Date.now()}],
 projectCategories:[
  {id:uid(),name:'Memory 管理'},
  {id:uid(),name:'客户询问'}
 ],
 projects:[],
 sopTemplates:[{id:uid(),name:'Database Refresh',category:'Database',description:'月次 Database Refresh 作业模板',links:[],steps:[
  {id:uid(),title:'事前确认',note:'确认作业窗口、对象环境、相关联系人。'},{id:uid(),title:'DB Backup',note:''},{id:uid(),title:'Stop Application',note:''},{id:uid(),title:'Refresh',note:''},{id:uid(),title:'Start Application',note:''},{id:uid(),title:'事后确认',note:''}
 ]}],
 executions:[],
 kanbanTemplates:[]
};
let state, routineViewDate=todayISO(), activeMemoId=null;

async function loadState(){
 await openDB(); state=await dbGet('state');
 if(!state) state=structuredClone(DEFAULT);
 migrate(); await saveState();
}
function migrate(){
 for(const[k,v]of Object.entries(DEFAULT)) if(state[k]===undefined)state[k]=structuredClone(v);
 state.routines.forEach(r=>{r.subtasks??=[]});
 state.kanban.forEach(k=>{k.html??=k.note||'';k.checks??=[];k.images??=[];k.tags??=[]});
 state.memos.forEach(m=>{m.html??=m.content||'';m.checks??=[];m.images??=[];m.tags??=[]});
 state.projects??=[]; state.projectCategories??=structuredClone(DEFAULT.projectCategories); state.kanbanColumns??=structuredClone(DEFAULT.kanbanColumns); state.kanbanTemplates??=[];
 state.kanban.forEach(k=>{k.startedAt??=null;k.completedAt??=null;k.dueAt??='';k.showMemo??=false;(k.checks||[]).forEach(c=>{c.startedAt??=null;c.completedAt??=c.done?Date.now():null;c.dueAt??='';});});
 state.projects.forEach(p=>{p.startedAt??=p.startAt||null;p.completedAt??=p.endAt||null;p.dueAt??='';(p.subtasks||[]).forEach(s=>{s.startedAt??=s.startAt||null;s.completedAt??=s.endAt||null;s.dueAt??='';s.done??=!!s.completedAt;});});
}
async function saveState(){await dbSet('state',state)}
function toast(msg){const el=document.createElement('div');el.className='toast';el.textContent=msg;$('#toastRoot').appendChild(el);setTimeout(()=>el.remove(),1800)}
function modal(html){$('#modalRoot').innerHTML=`<div class="modal-backdrop"><div class="modal">${html}</div></div>`}
function closeModal(){$('#modalRoot').innerHTML=''}
function drawer(html){$('#drawerRoot').innerHTML=`<div class="drawer-backdrop"></div><aside class="drawer">${html}</aside>`}
function closeDrawer(){$('#drawerRoot').innerHTML=''}

function goPage(n){
 $$('.page').forEach(x=>x.classList.remove('active'));$(`#page-${n}`).classList.add('active');
 $$('.nav-item').forEach(x=>x.classList.toggle('active',x.dataset.page===n));
 $('#pageTitle').textContent=({today:'Today',routine:'Routine',projects:'Projects',sop:'SOP',history:'Execution History',kanban:'Kanban',memo:'Memo',settings:'Settings'})[n];
 renderPage(n);
}
function renderPage(n){({today:renderToday,routine:renderRoutine,projects:renderProjects,sop:renderSOP,history:renderHistory,kanban:renderKanban,memo:renderMemo,settings:renderSettings}[n]||(()=>{}))()}
function renderAll(){ $('#todayText').textContent=fmtDate(todayISO()); renderPage($('.nav-item.active')?.dataset.page||'today') }

function richToolbar(id){
 return `<div class="rich-toolbar">
  <button type="button" onclick="richCmd('${id}','bold')"><b>B</b></button>
  <button type="button" onclick="richCmd('${id}','underline')"><u>U</u></button>
  <button type="button" onclick="richHighlight('${id}')">🖍 高亮</button>
  <button type="button" onclick="richCmd('${id}','insertUnorderedList')">• List</button>
  <button type="button" onclick="richCmd('${id}','indent')">→ 缩进</button>
  <button type="button" onclick="richCmd('${id}','outdent')">← 回缩</button>
  <input type="color" title="字体颜色" onchange="richColor('${id}',this.value)"/>
  <button type="button" onclick="richLink('${id}')">🔗 Link</button>
  <button type="button" onclick="insertInlineCheckbox('${id}')">☑ Checkbox</button>
  <button type="button" onclick="pickInlineImage('${id}')">🖼 图片</button>
 </div>`;
}
function richEditor(id,html,placeholder='输入内容…'){return `${richToolbar(id)}<div id="${id}" class="rich-editor" contenteditable="true" data-placeholder="${esc(placeholder)}">${html||''}</div><input id="${id}File" type="file" accept="image/*" style="display:none" onchange="insertSelectedImage('${id}',this)">`}
function richCmd(id,cmd){document.getElementById(id)?.focus();document.execCommand(cmd,false,null)}
function richColor(id,c){document.getElementById(id)?.focus();document.execCommand('foreColor',false,c)}
function richHighlight(id){document.getElementById(id)?.focus();try{document.execCommand('hiliteColor',false,'#fff59d')}catch(e){document.execCommand('backColor',false,'#fff59d')}}
function richLink(id){const u=prompt('输入链接 URL');if(!u)return;document.getElementById(id)?.focus();document.execCommand('createLink',false,u)}
function inlineTaskMarkup(t={}){
 const id=t.id||uid(), title=esc(t.text||t.title||'新子任务'), due=esc(t.dueAt||''), st=t.startedAt||'', done=t.completedAt||'', checked=t.done||t.completedAt;
 return `<span class="inline-task" data-task-id="${id}" data-started="${st||''}" data-completed="${done||''}" data-due="${due}" contenteditable="false">
   <button type="button" class="inline-start" onclick="inlineTaskStart(this)">▶ Start</button>
   <input type="checkbox" ${checked?'checked':''} onchange="inlineTaskDone(this)">
   <span class="inline-task-text" contenteditable="true">${title}</span>
   <button type="button" class="inline-due" onclick="inlineTaskDue(this)">⏰</button>
   <span class="inline-task-meta">${st?fmtTime(Number(st)):'未开始'}${due?' · 预计 '+due.replace('T',' '):''}${done?' · 完成 '+fmtTime(Number(done)):''}</span>
 </span>`;
}
function insertInlineCheckbox(id){
 const ed=document.getElementById(id); if(!ed)return;
 const title=prompt('子任务名称','新子任务'); if(title===null)return;
 ed.focus(); document.execCommand('insertHTML',false,inlineTaskMarkup({id:uid(),text:title})+'&nbsp;');
}
function inlineTaskStart(btn){
 const el=btn.closest('.inline-task'); if(!el)return;
 if(!el.dataset.started) el.dataset.started=String(Date.now());
 refreshInlineTask(el);
}
function inlineTaskDone(cb){
 const el=cb.closest('.inline-task'); if(!el)return;
 if(cb.checked){
   if(!el.dataset.started) el.dataset.started=String(Date.now());
   el.dataset.completed=String(Date.now());
 }else{
   el.dataset.completed='';
 }
 refreshInlineTask(el);
}
function inlineTaskDue(btn){
 const el=btn.closest('.inline-task'); if(!el)return;
 const cur=(el.dataset.due||'').replace('T',' ');
 const v=prompt('预计完成时间（例如 2026-08-14 15:30，留空则清除）',cur);
 if(v===null)return;
 el.dataset.due=v.trim()?v.trim().replace(' ','T'):'';
 refreshInlineTask(el);
}
function refreshInlineTask(el){
 const st=el.dataset.started?Number(el.dataset.started):null, done=el.dataset.completed?Number(el.dataset.completed):null, due=el.dataset.due||'';
 const meta=el.querySelector('.inline-task-meta');
 if(meta) meta.textContent=`${st?fmtTime(st):'未开始'}${due?' · 预计 '+due.replace('T',' '):''}${done?' · 完成 '+fmtTime(done):''}`;
 const cb=el.querySelector('input[type=checkbox]'); if(cb)cb.checked=!!done;
}
function collectInlineTasks(editorId){
 const ed=document.getElementById(editorId); if(!ed)return[];
 return [...ed.querySelectorAll('.inline-task')].map(el=>({
   id:el.dataset.taskId||uid(),
   text:(el.querySelector('.inline-task-text')?.innerText||'').trim(),
   dueAt:el.dataset.due||'',
   startedAt:el.dataset.started?Number(el.dataset.started):null,
   completedAt:el.dataset.completed?Number(el.dataset.completed):null,
   done:!!el.dataset.completed
 })).filter(x=>x.text);
}
function mergeTasksIntoHtml(html,tasks=[]){
 let result=html||'';
 for(const t of tasks){
   if(result.includes(`data-task-id="${t.id}"`))continue;
   result += `<div>${inlineTaskMarkup(t)}</div>`;
 }
 return result;
}
function pickInlineImage(id){document.getElementById(id+'File')?.click()}
function insertSelectedImage(id,input){const f=input.files?.[0];if(!f)return;const r=new FileReader();r.onload=()=>insertImageAtCaret(id,r.result);r.readAsDataURL(f);input.value=''}
function insertImageAtCaret(id,data){document.getElementById(id)?.focus();document.execCommand('insertHTML',false,`<img src="${data}" alt="image">`)}
function wireImageDrop(zoneId,editorId,callback){
 const z=document.getElementById(zoneId),ed=document.getElementById(editorId); if(!ed)return;
 if(z){z.ondragover=e=>e.preventDefault();z.ondrop=e=>{e.preventDefault();filesToData([...e.dataTransfer.files],im=>{insertImageAtCaret(editorId,im.data);callback?.(im)})}}
 ed.onpaste=e=>{const fs=[...e.clipboardData.items].filter(i=>i.type.startsWith('image/')).map(i=>i.getAsFile());if(fs.length){e.preventDefault();filesToData(fs,im=>{insertImageAtCaret(editorId,im.data);callback?.(im)})}};
}
function filesToData(files,cb){files.filter(f=>f&&f.type.startsWith('image/')).forEach(f=>{const r=new FileReader();r.onload=()=>cb({id:uid(),name:f.name||'pasted-image',data:r.result});r.readAsDataURL(f)})}

function isRoutineDue(r,date){const wd=new Date(date+'T12:00:00').getDay();if(r.repeat==='daily')return true;if(r.repeat==='weekdays')return wd>=1&&wd<=5;return(r.weekdays||[]).includes(wd)}
function getRLog(d,id){return state.routineLogs?.[d]?.[id]||null}
async function setRoutineStatus(d,id,status){
 state.routineLogs[d]??={}; const old=state.routineLogs[d][id]||{subtasks:{}};
 state.routineLogs[d][id]={...old,status,completedAt:status==='done'?Date.now():null}; await saveState();renderAll()
}
async function toggleRoutineSub(d,rid,sid,done){
 state.routineLogs[d]??={};state.routineLogs[d][rid]??={status:'',subtasks:{}};state.routineLogs[d][rid].subtasks??={};
 state.routineLogs[d][rid].subtasks[sid]=done?{done:true,completedAt:Date.now()}:{done:false,completedAt:null};await saveState();renderAll()
}
function routineItem(r,d){
 const log=getRLog(d,r.id),st=log?.status||'';
 return `<div class="item"><div class="item-row"><div><div class="item-title">${esc(r.name)}</div><div class="item-meta">${log?.completedAt?'主任务完成 '+fmtTime(log.completedAt):'主任务未完成'}</div></div>
 <div class="status-group"><button class="status-btn done ${st==='done'?'active':''}" onclick="setRoutineStatus('${d}','${r.id}','done')">✅完成</button><button class="status-btn leave ${st==='leave'?'active':''}" onclick="setRoutineStatus('${d}','${r.id}','leave')">🏖休假</button><button class="status-btn na ${st==='na'?'active':''}" onclick="setRoutineStatus('${d}','${r.id}','na')">➖N/A</button><button class="status-btn miss ${st==='miss'?'active':''}" onclick="setRoutineStatus('${d}','${r.id}','miss')">✕未完成</button></div></div>
 ${(r.subtasks||[]).map(s=>{const sl=log?.subtasks?.[s.id];return `<label class="checkbox-line subtask"><input type="checkbox" ${sl?.done?'checked':''} onchange="toggleRoutineSub('${d}','${r.id}','${s.id}',this.checked)"><span>${esc(s.title)}</span><span class="item-meta">${sl?.completedAt?fmtTime(sl.completedAt):''}</span></label>`}).join('')}
 </div>`
}
function renderToday(){
 const d=todayISO(),rs=state.routines.filter(r=>isRoutineDue(r,d)),done=rs.filter(r=>getRLog(d,r.id)?.status==='done').length;
 const activeP=state.projects.filter(p=>p.status!=='done').length;
 const activeK=state.kanban.filter(x=>x.status!=='done'&&!x.completedAt);
 $('#page-today').innerHTML=`<div class="grid grid-3"><div class="card"><div class="kpi">${done}/${rs.length}</div><div class="kpi-label">今日 Routine</div></div><div class="card"><div class="kpi">${activeP}</div><div class="kpi-label">长期任务 / Projects</div></div><div class="card"><div class="kpi">${activeK.length}</div><div class="kpi-label">Kanban 未完成</div></div></div><div class="grid grid-2" style="margin-top:18px"><div class="card"><div class="section-title"><h2>今日 Routine</h2><button class="small-btn" onclick="goPage('routine')">历史</button></div>${rs.map(r=>routineItem(r,d)).join('')}</div><div class="card"><div class="section-title"><h2>长期任务</h2><button class="small-btn" onclick="goPage('projects')">全部</button></div>${state.projects.filter(p=>p.status!=='done').slice(0,6).map(p=>projectSummary(p)).join('')||'<div class="empty">还没有长期任务</div>'}</div></div><div class="card" style="margin-top:18px"><div class="section-title"><h2>📊 Kanban</h2><button class="small-btn" onclick="goPage('kanban')">打开看板</button></div><div class="grid grid-3">${activeK.slice(0,9).map(t=>cardHtml(t)).join('')||'<div class="empty">没有未完成卡片</div>'}</div></div>`
}

function repeatText(r){if(r.repeat==='daily')return'每天';if(r.repeat==='weekdays')return'工作日';return'指定星期'}
function renderRoutine(){
 const due=state.routines.filter(r=>isRoutineDue(r,routineViewDate));
 $('#page-routine').innerHTML=`<div class="card"><div class="section-title"><h2>Daily Routine</h2><button class="primary-btn" onclick="openRoutineModal()">＋ 新建 Routine</button></div>
 <div class="form-row"><div class="form-field"><label>查看日期</label><input type="date" value="${routineViewDate}" onchange="routineViewDate=this.value;renderRoutine()"></div><div class="item">${fmtDate(routineViewDate)}</div></div>
 <div class="list" style="margin-top:14px">${due.map(r=>routineItem(r,routineViewDate)).join('')}</div></div>
 <div class="card" style="margin-top:18px"><h2>Routine 管理</h2>${state.routines.map(r=>`<div class="item"><div class="item-row"><div><b>${esc(r.name)}</b><div class="item-meta">${repeatText(r)} · ${(r.subtasks||[]).length} 个子任务</div></div><button class="small-btn" onclick="openRoutineModal('${r.id}')">编辑</button></div></div>`).join('')}</div>`
}
function openRoutineModal(id){
 const r=state.routines.find(x=>x.id===id)||{name:'',repeat:'weekdays',weekdays:[1,2,3,4,5],subtasks:[]};
 modal(`<h2>${id?'编辑':'新建'} Routine</h2><div class="form-field"><label>名称</label><input id="rName" value="${esc(r.name)}"></div>
 <div class="form-field"><label>重复</label><select id="rRepeat"><option value="daily" ${r.repeat==='daily'?'selected':''}>每天</option><option value="weekdays" ${r.repeat==='weekdays'?'selected':''}>工作日</option><option value="custom" ${r.repeat==='custom'?'selected':''}>指定星期</option></select></div>
 <div>${['日','一','二','三','四','五','六'].map((n,i)=>`<label class="checkbox-line"><input type="checkbox" class="rWeek" value="${i}" ${(r.weekdays||[]).includes(i)?'checked':''}>周${n}</label>`).join('')}</div>
 <h3>子任务</h3><div id="rSubs">${(r.subtasks||[]).map(s=>`<div class="item rsub" data-id="${s.id}"><input class="rsub-title" value="${esc(s.title)}"><button class="danger-btn" onclick="this.parentElement.remove()">删除</button></div>`).join('')}</div>
 <button class="small-btn" onclick="$('#rSubs').insertAdjacentHTML('beforeend','<div class=&quot;item rsub&quot; data-id=&quot;${uid()}&quot;><input class=&quot;rsub-title&quot;><button class=&quot;danger-btn&quot; onclick=&quot;this.parentElement.remove()&quot;>删除</button></div>')">＋子任务</button>
 <div class="modal-actions"><button class="ghost-btn" onclick="closeModal()">取消</button><button class="primary-btn" onclick="saveRoutine('${id||''}')">保存</button></div>`)
}
async function saveRoutine(id){
 const x={id:id||uid(),name:$('#rName').value.trim(),repeat:$('#rRepeat').value,weekdays:$$('.rWeek:checked').map(x=>+x.value),subtasks:$$('.rsub').map(e=>({id:e.dataset.id,title:e.querySelector('.rsub-title').value.trim()})).filter(x=>x.title)};
 if(id)state.routines[state.routines.findIndex(r=>r.id===id)]=x;else state.routines.push(x);await saveState();closeModal();renderAll()
}

let projectFilter='';
function renderProjects(){
 const cats=state.projectCategories;
 $('#page-projects').innerHTML=`<div class="section-title"><h2>长期任务 / Projects</h2><div><button class="ghost-btn" onclick="openCategoryModal()">＋ 分类</button> <button class="primary-btn" onclick="openProjectCreate()">＋ 新建项目</button></div></div>
 <div class="filterbar"><input placeholder="搜索标题 / 标签" value="${esc(projectFilter)}" oninput="projectFilter=this.value;renderProjects()"></div>
 ${cats.map(c=>{const ps=state.projects.filter(p=>p.categoryId===c.id).filter(projectMatch);return `<div class="card category-card" style="margin-bottom:16px"><div class="section-title"><h2>${esc(c.name)}</h2><button class="small-btn" onclick="openCategoryModal('${c.id}')">编辑分类</button></div>
 ${ps.map(p=>projectSummary(p)).join('')||'<div class="empty">这个分类还没有项目</div>'}</div>`}).join('')}
 <div class="card category-card"><div class="section-title"><h2>未分类</h2></div>${state.projects.filter(p=>!p.categoryId).filter(projectMatch).map(projectSummary).join('')||'<div class="empty">无</div>'}</div>`
}
function projectMatch(p){const q=projectFilter.trim().toLowerCase();return !q||p.title.toLowerCase().includes(q)||(p.tags||[]).some(t=>t.toLowerCase().includes(q))}
function projectSummary(p){
 const tasks=p.subtasks||[], done=tasks.filter(x=>x.done||x.completedAt).length;
 return `<div class="item project-row"><div class="card-topline"><input class="main-check" type="checkbox" ${p.completedAt?'checked':''} onchange="event.stopPropagation();finishProject('${p.id}',this.checked)"><div class="card-body" onclick="openProject('${p.id}')"><div class="item-title">${esc(p.title)}</div><div class="item-meta">Start ${fmtTime(p.startedAt)} · Done ${fmtTime(p.completedAt)} · ${done}/${tasks.length} 子任务</div>${p.dueAt?`<div class="time-badge ${dueClass(p.dueAt)}">${dueText(p.dueAt)}</div>`:''}<div class="tags">${tagHtml(p.tags)}</div></div></div><div class="card-actions">${!p.startedAt?`<button class="small-btn" onclick="event.stopPropagation();startProject('${p.id}')">▶ Start</button>`:''}</div>${tasks.length?`<div class="sub-list">${tasks.map(s=>`<div class="sub-inline"><input type="checkbox" ${s.done||s.completedAt?'checked':''} onchange="toggleProjectSub('${p.id}','${s.id}',this.checked)"><span>${esc(s.text||s.title)}</span>${!s.startedAt?`<button class="small-btn" onclick="startProjectSub('${p.id}','${s.id}')">Start</button>`:`<span class="time-badge">${fmtTime(s.startedAt)}→${fmtTime(s.completedAt)}</span>`}${s.dueAt?`<span class="time-badge ${dueClass(s.dueAt)}">${dueText(s.dueAt)}</span>`:''}</div>`).join('')}</div>`:''}</div>`
}
function openCategoryModal(id){const c=state.projectCategories.find(x=>x.id===id)||{name:''};modal(`<h2>${id?'编辑':'新建'}分类</h2><input id="catName" value="${esc(c.name)}"><div class="modal-actions"><button class="ghost-btn" onclick="closeModal()">取消</button><button class="primary-btn" onclick="saveCategory('${id||''}')">保存</button></div>`)}
async function saveCategory(id){const n=$('#catName').value.trim();if(!n)return;if(id)state.projectCategories.find(x=>x.id===id).name=n;else state.projectCategories.push({id:uid(),name:n});await saveState();closeModal();renderProjects()}
function openProjectCreate(){modal(`<h2>新建长期任务</h2><div class="form-field"><label>标题</label><input id="pTitle"></div><div class="form-field"><label>分类</label><select id="pCat"><option value="">未分类</option>${state.projectCategories.map(c=>`<option value="${c.id}">${esc(c.name)}</option>`).join('')}</select></div><div class="modal-actions"><button class="ghost-btn" onclick="closeModal()">取消</button><button class="primary-btn" onclick="createProject()">创建</button></div>`)}
async function createProject(){const p={id:uid(),title:$('#pTitle').value.trim(),categoryId:$('#pCat').value,status:'todo',tags:[],startedAt:null,completedAt:null,dueAt:'',html:'',subtasks:[],handoffs:[],reports:[],questions:[],investigations:[],createdAt:Date.now()};if(!p.title)return;state.projects.unshift(p);await saveState();closeModal();renderProjects();openProject(p.id)}
function openProject(id){const p=state.projects.find(x=>x.id===id);if(!p)return;drawer(`<div class="drawer-head"><div><h2 style="margin:0">${esc(p.title)}</h2><div class="item-meta">实际开始 ${fmtTime(p.startedAt)} · 实际完成 ${fmtTime(p.completedAt)}</div><div class="tags">${tagHtml(p.tags)}</div></div><button class="ghost-btn" onclick="closeDrawer()">✕</button></div><div class="card-actions" style="margin-top:14px">${!p.startedAt?`<button class="primary-btn" onclick="startProject('${p.id}')">▶ Start 主任务</button>`:''}<button class="ghost-btn" onclick="finishProject('${p.id}')">✅ 完成主任务</button></div><div class="detail-grid" style="margin-top:14px"><div class="form-field"><label>标题</label><input id="pdTitle" value="${esc(p.title)}"></div><div class="form-field"><label>分类</label><select id="pdCat"><option value="">未分类</option>${state.projectCategories.map(c=>`<option value="${c.id}" ${p.categoryId===c.id?'selected':''}>${esc(c.name)}</option>`).join('')}</select></div></div><div class="detail-grid"><div class="form-field"><label>预计完成时间</label><input type="datetime-local" id="pdDue" value="${esc(p.dueAt||'')}"></div><div class="form-field"><label>状态</label><select id="pdStatus"><option value="todo" ${p.status==='todo'?'selected':''}>TODO</option><option value="doing" ${p.status==='doing'?'selected':''}>DOING</option><option value="waiting" ${p.status==='waiting'?'selected':''}>WAITING</option><option value="done" ${p.status==='done'?'selected':''}>DONE</option></select></div></div><div class="form-field"><label>标签</label><input id="pdTags" value="${esc((p.tags||[]).join(', '))}"></div><h3>项目 Memo / 说明</h3>${richEditor('projectRich',mergeTasksIntoHtml(p.html,p.subtasks||[]),'文字、子任务、图片、链接可混排；用 ☑ Checkbox 插入项目子任务…')}<div id="projectDrop" class="drop-zone">Ctrl+V 或拖入图片到 Memo 光标位置</div>${richNoteSection('交接 / 对接人员','handoffs',p)}${richNoteSection('汇报记录','reports',p)}${richNoteSection('被提出的问题','questions',p)}${richNoteSection('需要调查的地方','investigations',p)}<div class="modal-actions"><button class="danger-btn" onclick="deleteProject('${p.id}')">删除项目</button><button class="primary-btn" onclick="saveProjectDrawer('${p.id}')">保存</button></div>`);wireImageDrop('projectDrop','projectRich');['handoffs','reports','questions','investigations'].forEach(k=>(p[k]||[]).forEach(n=>wireImageDrop(`${k}Drop_${n.id}`,`${k}Rich_${n.id}`)))}
function projectSubRow(s){return `<div class="item psub" data-id="${s.id}"><div class="project-sub-inline"><input type="checkbox" class="ps-done" ${s.done||s.completedAt?'checked':''}><input class="ps-title" value="${esc(s.title)}">${!s.startedAt?`<button class="small-btn" type="button" onclick="startProjectSubUI(this)">Start</button>`:`<span class="time-badge">${fmtTime(s.startedAt)}→${fmtTime(s.completedAt)}</span>`}<span></span></div><div class="detail-grid" style="margin-top:8px"><input type="datetime-local" class="ps-due" title="预计完成时间" value="${esc(s.dueAt||'')}"><textarea class="ps-note" placeholder="子任务 Memo">${esc(s.note||'')}</textarea></div><input type="hidden" class="ps-started" value="${s.startedAt||''}"><input type="hidden" class="ps-completed" value="${s.completedAt||''}"><button class="danger-btn" onclick="this.closest('.psub').remove()">删除</button></div>`}
function addProjectSub(){document.getElementById('projectSubs').insertAdjacentHTML('beforeend',projectSubRow({id:uid(),title:'',dueAt:'',startedAt:null,completedAt:null,note:'',done:false}))}
function startProjectSubUI(btn){const e=btn.closest('.psub');e.querySelector('.ps-started').value=Date.now();btn.outerHTML=`<span class="time-badge">已开始</span>`}
function richNoteSection(title,key,p){return `<h3>${title}</h3><div id="${key}List">${(p[key]||[]).map(n=>richNoteRow(key,n)).join('')}</div><button class="small-btn" onclick="addRichNoteRow('${key}')">＋ 添加记录</button>`}
function richNoteRow(key,n){return `<div class="panel-note nrow" data-id="${n.id}"><div class="note-toolbar"><b>${esc(n.who||'记录')}</b><button class="danger-btn" onclick="this.closest('.nrow').remove()">删除</button></div><div class="detail-grid"><input class="n-date" type="datetime-local" value="${esc(n.date||'')}"><input class="n-who" placeholder="人员 / 对象" value="${esc(n.who||'')}"></div>${richEditor(`${key}Rich_${n.id}`,n.html??esc(n.text||''),'支持文字、图片、link、checkbox、高亮…')}<div id="${key}Drop_${n.id}" class="drop-zone">Ctrl+V / 拖图片</div></div>`}
function addRichNoteRow(key){const n={id:uid(),date:'',who:'',html:''};document.getElementById(key+'List').insertAdjacentHTML('beforeend',richNoteRow(key,n));wireImageDrop(`${key}Drop_${n.id}`,`${key}Rich_${n.id}`)}
function collectRichNotes(key){return [...document.querySelectorAll(`#${key}List .nrow`)].map(e=>({id:e.dataset.id,date:e.querySelector('.n-date').value,who:e.querySelector('.n-who').value.trim(),html:e.querySelector(`#${key}Rich_${e.dataset.id}`).innerHTML})).filter(x=>x.date||x.who||x.html)}
async function startProject(id){const p=state.projects.find(x=>x.id===id);if(!p.startedAt)p.startedAt=Date.now();p.status='doing';await saveState();openProject(id);renderProjects()}
async function finishProject(id,done=true){
 const p=state.projects.find(x=>x.id===id);if(!p)return;
 if(done){if(!p.startedAt)p.startedAt=Date.now();p.completedAt=Date.now();p.status='done'}
 else{p.completedAt=null;if(p.status==='done')p.status='doing'}
 await saveState();renderProjects();if($('#drawerRoot .drawer'))openProject(id)
}
async function startProjectSub(pid,sid){
 const p=state.projects.find(x=>x.id===pid),s=p?.subtasks?.find(x=>x.id===sid);if(!s)return;
 if(!s.startedAt)s.startedAt=Date.now();if(!p.startedAt)p.startedAt=Date.now();await saveState();renderProjects()
}
async function toggleProjectSub(pid,sid,done){
 const p=state.projects.find(x=>x.id===pid),s=p?.subtasks?.find(x=>x.id===sid);if(!s)return;
 s.done=done;if(done){if(!s.startedAt)s.startedAt=Date.now();s.completedAt=Date.now()}else s.completedAt=null;
 if(done&&p.subtasks.length&&p.subtasks.every(x=>x.done||x.completedAt)){if(!p.startedAt)p.startedAt=Date.now();p.completedAt=Date.now();p.status='done'}
 await saveState();renderProjects()
}
async function saveProjectDrawer(id){
 const p=state.projects.find(x=>x.id===id);
 const tasks=collectInlineTasks('projectRich').map(x=>({...x,title:x.text,note:''}));
 Object.assign(p,{title:$('#pdTitle').value.trim(),categoryId:$('#pdCat').value,dueAt:$('#pdDue').value,status:$('#pdStatus').value,tags:splitTags($('#pdTags').value),html:$('#projectRich').innerHTML,subtasks:tasks,handoffs:collectRichNotes('handoffs'),reports:collectRichNotes('reports'),questions:collectRichNotes('questions'),investigations:collectRichNotes('investigations')});
 if(p.subtasks.length&&p.subtasks.every(x=>x.done)&&!p.completedAt){
   if(!p.startedAt)p.startedAt=Date.now();p.completedAt=Date.now();p.status='done';
 }
 await saveState();closeDrawer();renderProjects();toast('项目已保存')
}
async function deleteProject(id){if(!confirm('删除这个项目？'))return;state.projects=state.projects.filter(x=>x.id!==id);await saveState();closeDrawer();renderProjects()}

function dueClass(due){if(!due)return'';const x=new Date(due).getTime()-Date.now();return x<0?'due-late':x<86400000?'due-soon':''}
function dueText(due){return due?`预计 ${due.replace('T',' ')}`:''}
async function startKanbanTask(id){const t=state.kanban.find(x=>x.id===id);if(!t.startedAt)t.startedAt=Date.now();if(t.status==='todo')t.status=state.kanbanColumns.find(c=>c.name.toUpperCase()==='DOING')?.id||'doing';await saveState();renderKanban()}
async function finishKanbanTask(id,done=true){const t=state.kanban.find(x=>x.id===id);if(!t)return;if(done){if(!t.startedAt)t.startedAt=Date.now();t.completedAt=Date.now();t.status=state.kanbanColumns.find(c=>c.name.toUpperCase()==='DONE')?.id||'done'}else t.completedAt=null;await saveState();renderKanban()}
async function startKanbanSub(tid,cid){const t=state.kanban.find(x=>x.id===tid),c=t?.checks?.find(x=>x.id===cid);if(!c)return;if(!c.startedAt)c.startedAt=Date.now();if(!t.startedAt)t.startedAt=Date.now();await saveState();renderKanban()}
async function toggleKanbanSub(tid,cid,done){const t=state.kanban.find(x=>x.id===tid),c=t?.checks?.find(x=>x.id===cid);if(!c)return;c.done=done;if(done){if(!c.startedAt)c.startedAt=Date.now();c.completedAt=Date.now()}else c.completedAt=null;if(done&&t.checks.length&&t.checks.every(x=>x.done)){if(!t.startedAt)t.startedAt=Date.now();t.completedAt=Date.now();t.status=state.kanbanColumns.find(c=>c.name.toUpperCase()==='DONE')?.id||'done'}await saveState();renderKanban()}
async function toggleCardMemo(id){const t=state.kanban.find(x=>x.id===id);t.showMemo=!t.showMemo;await saveState();renderKanban()}
async function saveKanbanTemplate(id){const t=state.kanban.find(x=>x.id===id);if(!t)return;const name=prompt('模板名称',t.title);if(!name)return;state.kanbanTemplates.push({id:uid(),name,title:t.title,html:t.html,tags:[...(t.tags||[])],checks:(t.checks||[]).map(c=>({id:uid(),text:c.text,done:false,startedAt:null,completedAt:null,dueAt:c.dueAt||''})),createdAt:Date.now()});await saveState();toast('已保存为模板')}
function createFromKanbanTemplate(){if(!state.kanbanTemplates.length)return toast('还没有模板');modal(`<h2>从模板创建</h2>${state.kanbanTemplates.map(t=>`<div class="item"><div class="item-row"><b>${esc(t.name)}</b><button class="primary-btn" onclick="applyKanbanTemplate('${t.id}')">使用</button></div></div>`).join('')}<div class="modal-actions"><button class="ghost-btn" onclick="closeModal()">关闭</button></div>`)}
async function applyKanbanTemplate(id){const x=state.kanbanTemplates.find(t=>t.id===id);if(!x)return;const t={id:uid(),title:x.title,status:state.kanbanColumns[0]?.id||'todo',html:x.html,tags:[...(x.tags||[])],checks:(x.checks||[]).map(c=>({...c,id:uid(),done:false,startedAt:null,completedAt:null})),images:[],startedAt:null,completedAt:null,dueAt:'',showMemo:false};state.kanban.push(t);await saveState();closeModal();renderKanban();openKanbanCard(t.id)}

let kanbanFilter='';
function renderKanban(){
 const cols=state.kanbanColumns;
 $('#page-kanban').innerHTML=`<div class="section-title"><h2>Kanban</h2><div><button class="ghost-btn" onclick="createFromKanbanTemplate()">📋 从模板</button> <button class="ghost-btn" onclick="addKanbanColumn()">＋ 新列</button> <button class="primary-btn" onclick="openKanbanCard()">＋ 新建卡片</button></div></div>
 <div class="filterbar"><input placeholder="按标题 / 标签筛选" value="${esc(kanbanFilter)}" oninput="kanbanFilter=this.value;renderKanban()"></div>
 <div class="kanban">${cols.map(c=>`<div class="kanban-col" ondragover="event.preventDefault()" ondrop="dropTask(event,'${c.id}')"><div class="item-row"><h3>${esc(c.name)}</h3><button class="small-btn" onclick="renameKanbanColumn('${c.id}')">⋯</button></div>${state.kanban.filter(x=>x.status===c.id).filter(k=>!kanbanFilter||k.title.toLowerCase().includes(kanbanFilter.toLowerCase())||(k.tags||[]).some(t=>t.toLowerCase().includes(kanbanFilter.toLowerCase()))).map(cardHtml).join('')}</div>`).join('')}</div>`
}
function cardHtml(t){const all=(t.checks||[]).length,done=(t.checks||[]).filter(x=>x.done).length;return `<div class="task-card" draggable="true" ondragstart="event.dataTransfer.setData('text/plain','${t.id}')"><div class="card-topline"><input class="main-check" type="checkbox" ${t.completedAt?'checked':''} onclick="event.stopPropagation()" onchange="finishKanbanTask('${t.id}',this.checked)"><div class="card-body" onclick="openKanbanCard('${t.id}')"><div class="item-title">${esc(t.title)}</div><div class="tags">${tagHtml(t.tags)}</div><div class="item-meta">Start ${fmtTime(t.startedAt)} · Done ${fmtTime(t.completedAt)} · ${done}/${all} 子任务</div>${t.dueAt?`<div class="time-badge ${dueClass(t.dueAt)}">${dueText(t.dueAt)}</div>`:''}</div></div><div class="card-actions">${!t.startedAt?`<button class="small-btn" onclick="event.stopPropagation();startKanbanTask('${t.id}')">▶ Start</button>`:''}<button class="small-btn" onclick="event.stopPropagation();toggleCardMemo('${t.id}')">${t.showMemo?'隐藏':'显示'} Memo</button><button class="small-btn" onclick="event.stopPropagation();saveKanbanTemplate('${t.id}')">☆ 模板</button></div>${t.showMemo&&t.html?`<div class="rich-preview">${t.html}</div>`:''}${all?`<div class="sub-list">${t.checks.map(c=>`<div class="sub-inline"><input type="checkbox" ${c.done?'checked':''} onchange="toggleKanbanSub('${t.id}','${c.id}',this.checked)"><span>${esc(c.text)}</span>${!c.startedAt?`<button class="small-btn" onclick="startKanbanSub('${t.id}','${c.id}')">Start</button>`:`<span class="time-badge">${fmtTime(c.startedAt)}→${fmtTime(c.completedAt)}</span>`}${c.dueAt?`<span class="time-badge ${dueClass(c.dueAt)}">${dueText(c.dueAt)}</span>`:''}</div>`).join('')}</div>`:''}</div>`}
function addKanbanColumn(){const n=prompt('新列名称，例如 REVIEW / BLOCKED');if(!n)return;state.kanbanColumns.push({id:uid(),name:n});saveState().then(renderKanban)}
function renameKanbanColumn(id){const c=state.kanbanColumns.find(x=>x.id===id),n=prompt('列名称',c.name);if(!n)return;c.name=n;saveState().then(renderKanban)}
async function dropTask(ev,status){const t=state.kanban.find(x=>x.id===ev.dataTransfer.getData('text/plain'));if(t){t.status=status;await saveState();renderKanban()}}
function openKanbanCard(id){
 const t=state.kanban.find(x=>x.id===id)||{id:'',title:'',status:state.kanbanColumns[0]?.id||'todo',html:'',checks:[],images:[],tags:[],startedAt:null,completedAt:null,dueAt:'',showMemo:false};
 const merged=mergeTasksIntoHtml(t.html,t.checks||[]);
 drawer(`<div class="drawer-head"><div><h2 style="margin:0">${id?'Kanban 卡片':'新建 Kanban 卡片'}</h2><div class="item-meta">实际开始 ${fmtTime(t.startedAt)} · 实际完成 ${fmtTime(t.completedAt)}</div></div><button class="ghost-btn" onclick="closeDrawer()">✕</button></div>
 <div class="form-field"><label>标题</label><input id="kcTitle" value="${esc(t.title)}"></div>
 <div class="detail-grid"><div class="form-field"><label>状态</label><select id="kcStatus">${state.kanbanColumns.map(c=>`<option value="${c.id}" ${t.status===c.id?'selected':''}>${esc(c.name)}</option>`).join('')}</select></div><div class="form-field"><label>主任务预计完成时间</label><input type="datetime-local" id="kcDue" value="${esc(t.dueAt||'')}"></div></div>
 <div class="form-field"><label>标签</label><input id="kcTags" value="${esc((t.tags||[]).join(', '))}"></div>
 <h3>Memo / 作业说明</h3>
 <div class="item-meta" style="margin-bottom:8px">子任务直接插在下面 Memo 任意位置。点工具栏“☑ Checkbox”即可插入；每个子任务自带 Start、预计时间和完成勾选。</div>
 ${richEditor('kanbanRich',merged,'文字、子任务、图片、链接都可以混排在这里…')}
 <div id="kanbanDrop" class="drop-zone">也可以 Ctrl+V 粘贴截图，或拖图片到编辑框光标位置</div>
 <div class="modal-actions">${id?`<button class="ghost-btn" onclick="saveKanbanTemplate('${t.id}')">☆ 保存为模板</button><button class="danger-btn" onclick="deleteKanban('${t.id}')">删除</button>`:''}<button class="primary-btn" onclick="saveKanbanDrawer('${t.id}')">保存</button></div>`);
 wireImageDrop('kanbanDrop','kanbanRich')
}
function addCheckRow(id){document.getElementById(id).insertAdjacentHTML('beforeend',checkRow({id:uid(),text:'',done:false,startedAt:null,completedAt:null,dueAt:''}))}
function collectChecks(sel,old=[]){return $$(sel+' .check-row').map(e=>{const prev=old.find(x=>x.id===e.dataset.id)||{};const done=e.querySelector('.c-done').checked;return{id:e.dataset.id,text:e.querySelector('.c-text').value.trim(),dueAt:e.querySelector('.c-due').value,done,startedAt:prev.startedAt||null,completedAt:done?(prev.completedAt||Date.now()):null}}).filter(x=>x.text)}
async function saveKanbanDrawer(id){
 let t=id?state.kanban.find(x=>x.id===id):{id:uid(),images:[],startedAt:null,completedAt:null,showMemo:false};
 const tasks=collectInlineTasks('kanbanRich');
 Object.assign(t,{title:$('#kcTitle').value.trim(),status:$('#kcStatus').value,tags:splitTags($('#kcTags').value),html:$('#kanbanRich').innerHTML,checks:tasks,dueAt:$('#kcDue').value});
 if(t.checks.length&&t.checks.every(x=>x.done)&&!t.completedAt){
   if(!t.startedAt)t.startedAt=Date.now();
   t.completedAt=Date.now();
   t.status=state.kanbanColumns.find(c=>c.name.toUpperCase()==='DONE')?.id||'done';
 }
 if(!id)state.kanban.push(t);
 await saveState();closeDrawer();renderKanban()
}
async function deleteKanban(id){state.kanban=state.kanban.filter(x=>x.id!==id);await saveState();closeDrawer();renderKanban()}
function imageGrid(images,type,id){return `<div class="memo-images">${(images||[]).map(im=>`<div><img src="${im.data}"><button class="danger-btn" onclick="deleteImage('${type}','${id}','${im.id}')">删除</button></div>`).join('')}</div>`}
async function deleteImage(type,id,iid){const arr=type==='kanban'?state.kanban.find(x=>x.id===id)?.images:type==='memo'?state.memos.find(x=>x.id===id)?.images:state.projects.find(x=>x.id===id)?.images;if(arr){const i=arr.findIndex(x=>x.id===iid);if(i>=0)arr.splice(i,1);await saveState(); if(type==='kanban')openKanbanCard(id);if(type==='memo')renderMemo();if(type==='project')openProject(id)}}

let memoFilter='';
function renderMemo(){
 if(!activeMemoId&&state.memos[0])activeMemoId=state.memos[0].id;const m=state.memos.find(x=>x.id===activeMemoId);
 $('#page-memo').innerHTML=`<div class="grid grid-2" style="grid-template-columns:300px 1fr"><div class="card"><div class="section-title"><h2>Memos</h2><button class="small-btn" onclick="newMemo()">＋</button></div><input placeholder="标题 / 标签筛选" value="${esc(memoFilter)}" oninput="memoFilter=this.value;renderMemo()">
 ${state.memos.filter(x=>!memoFilter||x.title.toLowerCase().includes(memoFilter.toLowerCase())||(x.tags||[]).some(t=>t.toLowerCase().includes(memoFilter.toLowerCase()))).map(x=>`<div class="item project-row" onclick="activeMemoId='${x.id}';renderMemo()"><b>${esc(x.title)}</b><div class="tags">${tagHtml(x.tags)}</div></div>`).join('')}</div>
 <div class="card">${m?memoEditor(m):'<div class="empty">新建一个 Memo</div>'}</div></div>`;
 if(m)wireImageDrop('memoDrop','memoRich',async im=>{m.images.push(im);m.updatedAt=Date.now();await saveState();renderMemo()})
}
function memoEditor(m){return `<div class="form-row"><input id="memoTitle" value="${esc(m.title)}"><input id="memoTags" placeholder="标签" value="${esc((m.tags||[]).join(', '))}"></div>
 <h3>内容</h3>${richEditor('memoRich',m.html,'Memo…')}<h3>Checkbox / 子任务</h3><div id="memoChecks">${(m.checks||[]).map(checkRow).join('')}</div><button class="small-btn" onclick="addCheckRow('memoChecks')">＋ Checkbox</button>
 <div id="memoDrop" class="drop-zone">Ctrl+V 粘贴截图，或拖图片到这里</div>${imageGrid(m.images,'memo',m.id)}
 <div class="modal-actions"><button class="danger-btn" onclick="deleteMemo('${m.id}')">删除</button><button class="primary-btn" onclick="saveMemo('${m.id}')">保存</button></div>`}
async function newMemo(){const m={id:uid(),title:'New Memo',html:'',checks:[],images:[],tags:[],updatedAt:Date.now()};state.memos.unshift(m);activeMemoId=m.id;await saveState();renderMemo()}
async function saveMemo(id){const m=state.memos.find(x=>x.id===id);Object.assign(m,{title:$('#memoTitle').value.trim(),tags:splitTags($('#memoTags').value),html:$('#memoRich').innerHTML,checks:collectChecks('#memoChecks'),updatedAt:Date.now()});await saveState();toast('Memo 已保存');renderMemo()}
async function deleteMemo(id){if(!confirm('删除 Memo？'))return;state.memos=state.memos.filter(x=>x.id!==id);activeMemoId=state.memos[0]?.id||null;await saveState();renderMemo()}

function renderSOP(){
 $('#page-sop').innerHTML=`<div class="section-title"><h2>SOP Templates</h2><button class="primary-btn" onclick="openSopTemplate()">＋ 新建 SOP</button></div><div class="grid grid-2">${state.sopTemplates.map(t=>`<div class="card"><span class="pill">${esc(t.category||'General')}</span><h2>${esc(t.name)}</h2><div class="muted">${esc(t.description||'')}</div><div style="margin:12px 0">${t.steps.map((s,i)=>`<div class="item-meta">${i+1}. ${esc(s.title)}</div>`).join('')}</div><button class="primary-btn" onclick="startSop('${t.id}')">▶ 开始作业</button> <button class="ghost-btn" onclick="openSopTemplate('${t.id}')">编辑</button></div>`).join('')}</div>`
}
function openSopTemplate(id){
 const t=state.sopTemplates.find(x=>x.id===id)||{name:'',category:'',description:'',links:[],steps:[]};
 modal(`<h2>${id?'编辑':'新建'} SOP</h2><div class="form-row"><input id="sName" placeholder="名称" value="${esc(t.name)}"><input id="sCat" placeholder="分类" value="${esc(t.category||'')}"></div><textarea id="sDesc">${esc(t.description||'')}</textarea><h3>步骤</h3><div id="sSteps">${t.steps.map(s=>`<div class="item sstep" data-id="${s.id}"><input class="ss-title" value="${esc(s.title)}"><textarea class="ss-note">${esc(s.note||'')}</textarea><button class="danger-btn" onclick="this.parentElement.remove()">删除</button></div>`).join('')}</div><button class="small-btn" onclick="$('#sSteps').insertAdjacentHTML('beforeend','<div class=&quot;item sstep&quot; data-id=&quot;${uid()}&quot;><input class=&quot;ss-title&quot;><textarea class=&quot;ss-note&quot;></textarea><button class=&quot;danger-btn&quot; onclick=&quot;this.parentElement.remove()&quot;>删除</button></div>')">＋步骤</button><div class="modal-actions"><button class="ghost-btn" onclick="closeModal()">取消</button><button class="primary-btn" onclick="saveSop('${id||''}')">保存</button></div>`)
}
async function saveSop(id){const t={id:id||uid(),name:$('#sName').value.trim(),category:$('#sCat').value.trim(),description:$('#sDesc').value.trim(),links:[],steps:$$('.sstep').map(e=>({id:e.dataset.id,title:e.querySelector('.ss-title').value.trim(),note:e.querySelector('.ss-note').value.trim()})).filter(x=>x.title)};if(id)state.sopTemplates[state.sopTemplates.findIndex(x=>x.id===id)]=t;else state.sopTemplates.push(t);await saveState();closeModal();renderSOP()}
function startSop(id){const t=state.sopTemplates.find(x=>x.id===id);modal(`<h2>开始：${esc(t.name)}</h2><input id="eDate" type="date" value="${todayISO()}"><input id="eEnv" placeholder="环境 / 对象"><textarea id="eNote" placeholder="备注"></textarea><div class="modal-actions"><button class="primary-btn" onclick="createExec('${id}')">创建执行记录</button></div>`)}
async function createExec(id){const t=state.sopTemplates.find(x=>x.id===id),e={id:uid(),templateId:id,templateName:t.name,date:$('#eDate').value,environment:$('#eEnv').value,note:$('#eNote').value,steps:t.steps.map(s=>({id:uid(),title:s.title,note:s.note,startedAt:null,completedAt:null,memo:''})),createdAt:Date.now(),completedAt:null};state.executions.unshift(e);await saveState();closeModal();openExec(e.id)}
function openExec(id){const e=state.executions.find(x=>x.id===id);drawer(`<div class="drawer-head"><h2>${esc(e.templateName)}</h2><button class="ghost-btn" onclick="closeDrawer()">✕</button></div><div class="muted">${e.date} · ${esc(e.environment||'')}</div>${e.steps.map((s,i)=>`<div class="sop-step ${s.completedAt?'completed':s.startedAt?'running':''}"><b>${i+1}. ${esc(s.title)}</b><div class="item-meta">Start ${fmtTime(s.startedAt)} · Done ${fmtTime(s.completedAt)} · ⏱ ${s.startedAt?msToText((s.completedAt||Date.now())-s.startedAt):'-'}</div><textarea onchange="saveExecMemo('${e.id}','${s.id}',this.value)">${esc(s.memo||'')}</textarea>${!s.startedAt?`<button class="small-btn" onclick="startExecStep('${e.id}','${s.id}')">▶ Start</button>`:!s.completedAt?`<button class="primary-btn" onclick="finishExecStep('${e.id}','${s.id}')">✅ Complete</button>`:''}</div>`).join('')}<button class="primary-btn" onclick="finishExec('${e.id}')">完成整个作业</button>`)}
async function startExecStep(eid,sid){state.executions.find(x=>x.id===eid).steps.find(x=>x.id===sid).startedAt=Date.now();await saveState();openExec(eid)}
async function finishExecStep(eid,sid){const s=state.executions.find(x=>x.id===eid).steps.find(x=>x.id===sid);if(!s.startedAt)s.startedAt=Date.now();s.completedAt=Date.now();await saveState();openExec(eid)}
async function saveExecMemo(eid,sid,v){state.executions.find(x=>x.id===eid).steps.find(x=>x.id===sid).memo=v;await saveState()}
async function finishExec(eid){state.executions.find(x=>x.id===eid).completedAt=Date.now();await saveState();closeDrawer();renderHistory()}
function renderHistory(){$('#page-history').innerHTML=`<div class="card"><table class="history-table"><thead><tr><th>日期</th><th>SOP</th><th>环境</th><th>状态</th><th></th></tr></thead><tbody>${state.executions.map(e=>`<tr><td>${e.date}</td><td>${esc(e.templateName)}</td><td>${esc(e.environment||'-')}</td><td>${e.completedAt?'✅完成':'🟡进行中'}</td><td><button class="small-btn" onclick="openExec('${e.id}')">查看</button></td></tr>`).join('')}</tbody></table></div>`}

function renderSettings(){$('#page-settings').innerHTML=`<div class="grid grid-2"><div class="card"><h2>💾 Backup</h2><button class="primary-btn" onclick="exportBackup()">导出 JSON 备份</button></div><div class="card"><h2>📥 Restore</h2><input type="file" id="importFile" accept=".json"><button class="ghost-btn" onclick="importBackup()">导入</button></div><div class="card"><h2>说明</h2><p class="muted">关闭浏览器不会自动清空 IndexedDB。换电脑、清理网站数据或公司 IT 重置浏览器时可能丢失本地数据，因此建议定期备份。</p></div></div>`}
function exportBackup(){const b=new Blob([JSON.stringify({version:2,exportedAt:new Date().toISOString(),state},null,2)],{type:'application/json'}),a=document.createElement('a');a.href=URL.createObjectURL(b);a.download=`my-workboard-backup-${todayISO()}.json`;a.click();URL.revokeObjectURL(a.href)}
async function importBackup(){const f=$('#importFile').files[0];if(!f)return;const o=JSON.parse(await f.text());if(!o.state)return;state=o.state;migrate();await saveState();renderAll();toast('恢复完成')}

document.addEventListener('DOMContentLoaded',async()=>{await loadState();$('#todayText').textContent=fmtDate(todayISO());$$('.nav-item').forEach(b=>b.onclick=()=>goPage(b.dataset.page));$('#quickBackupBtn').onclick=exportBackup;goPage('today')})


/* ======================= V5 OVERRIDES ======================= */
let kanbanCalMonth=todayISO().slice(0,7), todayCalMonth=todayISO().slice(0,7), globalTagQuery='';

function migrateV5(){
 for(const[k,v]of Object.entries(DEFAULT)) if(state[k]===undefined)state[k]=structuredClone(v);
 state.kanbanRecurring??=[];
 state.routines??=[]; state.projects??=[]; state.memos??=[]; state.kanban??=[]; state.sopTemplates??=[];
 state.routines.forEach(r=>{r.tags??=[];r.subtasks??=[]});
 const norm=(arr=[])=>arr.map(t=>({id:t.id||uid(),text:t.text||t.title||'子任务',dueAt:t.dueAt||'',startedAt:t.startedAt||null,completedAt:t.completedAt||null,done:!!(t.done||t.completedAt),children:norm(t.children||[])}));
 state.kanban.forEach(k=>{k.tags??=[];k.checks=norm(k.checks);k.html??='';k.startedAt??=null;k.completedAt??=null;k.dueAt??='';k.showMemo??=false});
 state.projects.forEach(p=>{p.tags??=[];p.subtasks=norm(p.subtasks);p.html??='';p.startedAt??=p.startAt||null;p.completedAt??=p.endAt||null;p.dueAt??='';p.status??='doing'});
 state.memos.forEach(m=>{m.tags??=[];m.html??=m.content||''});
 state.sopTemplates.forEach(t=>{t.steps??=[];t.steps.forEach(s=>{s.noteHtml??=(s.note?`<p>${esc(s.note)}</p>`:'')})});
 state.executions??=[];state.executions.forEach(e=>(e.steps||[]).forEach(s=>{s.memoHtml??=(s.memo?`<p>${esc(s.memo)}</p>`:'');s.noteHtml??=(s.note?`<p>${esc(s.note)}</p>`:'')}));
}
async function loadState(){await openDB();state=await dbGet('state');if(!state)state=structuredClone(DEFAULT);migrate();migrateV5();const changed=ensureRecurringKanban();await saveState();}

function clearTaskTimes(tasks=[]){return tasks.map(t=>({id:uid(),text:t.text||t.title||'',dueAt:t.dueAt||'',startedAt:null,completedAt:null,done:false,children:clearTaskTimes(t.children||[])}))}
function flattenTasks(tasks=[]){return tasks.flatMap(t=>[t,...flattenTasks(t.children||[])])}
function countTasks(tasks=[]){const a=flattenTasks(tasks);return{all:a.length,done:a.filter(x=>x.done||x.completedAt).length}}
function tasksAllDone(tasks=[]){const a=flattenTasks(tasks);return a.length>0&&a.every(x=>x.done||x.completedAt)}
function findTaskRec(tasks,id){for(const t of tasks||[]){if(t.id===id)return t;const x=findTaskRec(t.children,id);if(x)return x}return null}
function taskDepthHtml(tasks=[],renderer,depth=0){return(tasks||[]).map(t=>renderer(t,depth)+taskDepthHtml(t.children||[],renderer,depth+1)).join('')}

function inlineTaskMarkup(t={}){
 const id=t.id||uid(),title=esc(t.text||t.title||'新子任务'),due=esc(t.dueAt||''),st=t.startedAt||'',done=t.completedAt||'',checked=t.done||t.completedAt;
 return `<div class="inline-task" data-task-id="${id}" data-started="${st||''}" data-completed="${done||''}" data-due="${due}" contenteditable="false"><div class="inline-task-head"><button type="button" class="inline-start" title="开始" onclick="inlineTaskStart(this)">▶</button><input type="checkbox" ${checked?'checked':''} onchange="inlineTaskDone(this)"><span class="inline-task-text" contenteditable="true">${title}</span><button type="button" class="inline-due" title="预计完成" onclick="inlineTaskDue(this)">⏰</button><button type="button" class="inline-child" title="添加下级子任务" onclick="inlineTaskAddChild(this)">＋↳</button></div><div class="inline-task-meta">${st?'Start '+fmtTime(Number(st)):'未开始'}${due?' · 预计 '+due.replace('T',' '):''}${done?' · Done '+fmtTime(Number(done)):''}</div><div class="inline-children">${(t.children||[]).map(inlineTaskMarkup).join('')}</div></div>`;
}
function inlineTaskAddChild(btn){const p=btn.closest('.inline-task'),box=p?.querySelector(':scope > .inline-children');if(!box)return;const name=prompt('下级子任务名称','新子任务');if(name===null)return;box.insertAdjacentHTML('beforeend',inlineTaskMarkup({id:uid(),text:name,children:[]}));}
function refreshInlineTask(el){const st=el.dataset.started?Number(el.dataset.started):null,done=el.dataset.completed?Number(el.dataset.completed):null,due=el.dataset.due||'';const meta=el.querySelector(':scope > .inline-task-meta');if(meta)meta.textContent=`${st?'Start '+fmtTime(st):'未开始'}${due?' · 预计 '+due.replace('T',' '):''}${done?' · Done '+fmtTime(done):''}`;const cb=el.querySelector(':scope > .inline-task-head > input[type=checkbox]');if(cb)cb.checked=!!done;}
function inlineTaskDone(cb){const el=cb.closest('.inline-task');if(!el)return;if(cb.checked){if(!el.dataset.started)el.dataset.started=String(Date.now());el.dataset.completed=String(Date.now())}else el.dataset.completed='';refreshInlineTask(el);let parent=el.parentElement?.closest('.inline-task');while(parent){const kids=[...parent.querySelectorAll(':scope > .inline-children > .inline-task')];if(kids.length&&kids.every(k=>!!k.dataset.completed)){if(!parent.dataset.started)parent.dataset.started=String(Date.now());parent.dataset.completed=String(Date.now());refreshInlineTask(parent)}parent=parent.parentElement?.closest('.inline-task')}}
function collectInlineTaskEl(el){return{id:el.dataset.taskId||uid(),text:(el.querySelector(':scope > .inline-task-head > .inline-task-text')?.innerText||'').trim(),dueAt:el.dataset.due||'',startedAt:el.dataset.started?Number(el.dataset.started):null,completedAt:el.dataset.completed?Number(el.dataset.completed):null,done:!!el.dataset.completed,children:[...el.querySelectorAll(':scope > .inline-children > .inline-task')].map(collectInlineTaskEl)}}
function collectInlineTasks(editorId){const ed=document.getElementById(editorId);if(!ed)return[];return[...ed.querySelectorAll('.inline-task')].filter(el=>!el.parentElement.closest('.inline-task')).map(collectInlineTaskEl).filter(x=>x.text)}
function mergeTasksIntoHtml(html,tasks=[]){let result=html||'';for(const t of tasks){if(!result.includes(`data-task-id="${t.id}"`))result+=`<div>${inlineTaskMarkup(t)}</div>`}return result}

function syncTasksIntoHtml(html,tasks=[]){const box=document.createElement('div');box.innerHTML=html||'';for(const t of flattenTasks(tasks)){const el=box.querySelector(`[data-task-id="${CSS.escape(t.id)}"]`);if(!el)continue;el.dataset.started=t.startedAt||'';el.dataset.completed=t.completedAt||'';el.dataset.due=t.dueAt||'';const cb=el.querySelector(':scope > .inline-task-head > input[type=checkbox]');if(cb)cb.checked=!!(t.done||t.completedAt);const meta=el.querySelector(':scope > .inline-task-meta');if(meta)meta.textContent=`${t.startedAt?'Start '+fmtTime(t.startedAt):'未开始'}${t.dueAt?' · 预计 '+t.dueAt.replace('T',' '):''}${t.completedAt?' · Done '+fmtTime(t.completedAt):''}`}return box.innerHTML}

function taskQuickTree(tasks,ownerType,ownerId,depth=0){return(tasks||[]).map(t=>`<div class="sub-inline nested-${Math.min(depth,4)}"><span class="tree-branch">${depth?'↳':''}</span><input type="checkbox" ${t.done||t.completedAt?'checked':''} onchange="toggleQuickTask('${ownerType}','${ownerId}','${t.id}',this.checked)"><span class="sub-name">${esc(t.text||t.title)}</span>${!t.startedAt?`<button class="micro-btn" title="Start" onclick="startQuickTask('${ownerType}','${ownerId}','${t.id}')">▶</button>`:`<span class="micro-time">${fmtTime(t.startedAt)}${t.completedAt?'→'+fmtTime(t.completedAt):''}</span>`}${t.dueAt?`<span class="micro-due ${dueClass(t.dueAt)}">${dueText(t.dueAt)}</span>`:''}</div>${taskQuickTree(t.children||[],ownerType,ownerId,depth+1)}`).join('')}
async function startQuickTask(type,oid,tid){const o=type==='kanban'?state.kanban.find(x=>x.id===oid):state.projects.find(x=>x.id===oid);const t=findTaskRec(type==='kanban'?o?.checks:o?.subtasks,tid);if(!o||!t)return;if(!t.startedAt)t.startedAt=Date.now();if(!o.startedAt)o.startedAt=Date.now();if(type==='kanban'&&o.status==='todo')o.status=state.kanbanColumns.find(c=>c.name.toUpperCase()==='DOING')?.id||'doing';o.html=syncTasksIntoHtml(o.html,type==='kanban'?o.checks:o.subtasks);await saveState();renderAll()}
async function toggleQuickTask(type,oid,tid,done){const o=type==='kanban'?state.kanban.find(x=>x.id===oid):state.projects.find(x=>x.id===oid);const tasks=type==='kanban'?o?.checks:o?.subtasks,t=findTaskRec(tasks,tid);if(!o||!t)return;t.done=done;if(done){if(!t.startedAt)t.startedAt=Date.now();t.completedAt=Date.now()}else t.completedAt=null;if(tasksAllDone(tasks)){if(!o.startedAt)o.startedAt=Date.now();o.completedAt=Date.now();o.status=type==='kanban'?(state.kanbanColumns.find(c=>c.name.toUpperCase()==='DONE')?.id||'done'):'done'}o.html=syncTasksIntoHtml(o.html,tasks);await saveState();renderAll()}

function recurrenceKey(rule,d=new Date()){const y=d.getFullYear(),m=String(d.getMonth()+1).padStart(2,'0');if(rule.frequency==='daily')return d.toISOString().slice(0,10);if(rule.frequency==='weekly'){const x=new Date(d);x.setDate(d.getDate()-((d.getDay()+6)%7));return x.toISOString().slice(0,10)}return `${y}-${m}`}
function recurrenceDue(rule,d=new Date()){if(rule.frequency==='daily')return true;if(rule.frequency==='weekly')return d.getDay()===Number(rule.weekday||1);return d.getDate()>=Number(rule.dayOfMonth||1)}
function recurringSnapshotFromCard(t){return{title:t.title,html:t.html,tags:[...(t.tags||[])],checks:clearTaskTimes(t.checks||[]),dueAt:''}}
function ensureRecurringKanban(){let changed=false;const now=new Date();for(const r of state.kanbanRecurring||[]){if(!r.enabled||!recurrenceDue(r,now))continue;const key=recurrenceKey(r,now);if(r.lastGeneratedKey===key)continue;const snap=r.snapshot||{},card={id:uid(),title:snap.title||r.name||'定期任务',status:r.targetColumnId||state.kanbanColumns[0]?.id||'todo',html:snap.html||'',checks:clearTaskTimes(snap.checks||[]),images:[],tags:[...(snap.tags||[])],startedAt:null,completedAt:null,dueAt:'',showMemo:false,recurrenceRuleId:r.id,generatedKey:key,createdAt:Date.now()};card.html=mergeTasksIntoHtml(card.html,card.checks);state.kanban.push(card);r.lastGeneratedKey=key;changed=true}return changed}
function openRepeatModal(id){const t=state.kanban.find(x=>x.id===id);if(!t)return;const r=state.kanbanRecurring.find(x=>x.sourceCardId===id)||{frequency:'monthly',dayOfMonth:1,weekday:1,targetColumnId:t.status,enabled:true};modal(`<h2>🔁 定期重复</h2><div class="form-field"><label>频率</label><select id="repFreq"><option value="monthly" ${r.frequency==='monthly'?'selected':''}>每月</option><option value="weekly" ${r.frequency==='weekly'?'selected':''}>每周</option><option value="daily" ${r.frequency==='daily'?'selected':''}>每天</option></select></div><div class="form-row"><div class="form-field"><label>每月几日（每月时）</label><input id="repDay" type="number" min="1" max="31" value="${r.dayOfMonth||1}"></div><div class="form-field"><label>星期（每周时 0=日,1=一...）</label><input id="repWeek" type="number" min="0" max="6" value="${r.weekday??1}"></div></div><div class="form-field"><label>自动生成到哪一列</label><select id="repCol">${state.kanbanColumns.map(c=>`<option value="${c.id}" ${r.targetColumnId===c.id?'selected':''}>${esc(c.name)}</option>`).join('')}</select></div><label class="checkbox-line"><input id="repEnabled" type="checkbox" ${r.enabled!==false?'checked':''}>启用</label><div class="modal-actions"><button class="ghost-btn" onclick="closeModal()">取消</button><button class="primary-btn" onclick="saveRepeatRule('${id}')">保存</button></div>`)}
async function saveRepeatRule(id){const t=state.kanban.find(x=>x.id===id);let r=state.kanbanRecurring.find(x=>x.sourceCardId===id);if(!r){r={id:uid(),sourceCardId:id};state.kanbanRecurring.push(r)}Object.assign(r,{name:t.title,frequency:$('#repFreq').value,dayOfMonth:+$('#repDay').value||1,weekday:+$('#repWeek').value||1,targetColumnId:$('#repCol').value,enabled:$('#repEnabled').checked,snapshot:recurringSnapshotFromCard(t)});ensureRecurringKanban();await saveState();closeModal();renderKanban();toast('定期重复已保存')}
async function moveKanbanColumn(id,delta){const i=state.kanbanColumns.findIndex(x=>x.id===id),j=i+delta;if(i<0||j<0||j>=state.kanbanColumns.length)return;[state.kanbanColumns[i],state.kanbanColumns[j]]=[state.kanbanColumns[j],state.kanbanColumns[i]];await saveState();renderKanban()}

function taskDate(t){if(t.completedAt)return new Date(t.completedAt);if(t.dueAt)return new Date(t.dueAt);if(t.startedAt)return new Date(t.startedAt);return null}
function shiftMonth(key,delta){const [y,m]=key.split('-').map(Number),d=new Date(y,m-1+delta,1);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`}
function calendarModule(monthKey,items,onShiftName,compact=false){const [y,m]=monthKey.split('-').map(Number),first=new Date(y,m-1,1),last=new Date(y,m,0),start=first.getDay();let cells=['日','一','二','三','四','五','六'].map(x=>`<div class="cal-week">${x}</div>`);for(let i=0;i<start;i++)cells.push('<div class="cal-day blank"></div>');for(let day=1;day<=last.getDate();day++){const ds=`${y}-${String(m).padStart(2,'0')}-${String(day).padStart(2,'0')}`,hits=items.filter(x=>{const dt=x.date;return dt&&dt.toISOString().slice(0,10)===ds});cells.push(`<div class="cal-day ${ds===todayISO()?'today':''}"><div class="cal-num">${day}</div>${hits.slice(0,compact?2:4).map(h=>`<div class="cal-event ${h.done?'done':''}" title="${esc(h.title)}">${esc(h.title)}</div>`).join('')}${hits.length>(compact?2:4)?`<div class="cal-more">+${hits.length-(compact?2:4)}</div>`:''}</div>`)}return `<div class="calendar-card"><div class="cal-head"><button class="micro-btn" onclick="${onShiftName}(-1)">‹</button><b>${y}年${m}月</b><button class="micro-btn" onclick="${onShiftName}(1)">›</button></div><div class="calendar-v5">${cells.join('')}</div></div>`}
function kanbanCalendarShift(d){kanbanCalMonth=shiftMonth(kanbanCalMonth,d);renderKanban()}
function todayCalendarShift(d){todayCalMonth=shiftMonth(todayCalMonth,d);renderToday()}
function kanbanCalendarItems(){return state.kanban.map(t=>({title:t.title,date:taskDate(t),done:!!t.completedAt}))}

function kanbanMiniActions(t){return `<div class="mini-actions">${!t.startedAt?`<button class="icon-btn" title="Start" onclick="event.stopPropagation();startKanbanTask('${t.id}')">▶</button>`:''}<button class="icon-btn" title="${t.showMemo?'隐藏':'显示'} Memo" onclick="event.stopPropagation();toggleCardMemo('${t.id}')">${t.showMemo?'🙈':'👁'}</button><button class="icon-btn" title="保存为模板" onclick="event.stopPropagation();saveKanbanTemplate('${t.id}')">☆</button><button class="icon-btn" title="定期重复" onclick="event.stopPropagation();openRepeatModal('${t.id}')">🔁</button></div>`}
function cardHtml(t){const n=countTasks(t.checks||[]);return `<div class="task-card" draggable="true" ondragstart="event.dataTransfer.setData('text/plain','${t.id}')"><div class="card-topline"><input class="main-check" type="checkbox" ${t.completedAt?'checked':''} onclick="event.stopPropagation()" onchange="finishKanbanTask('${t.id}',this.checked)"><div class="card-body" onclick="openKanbanCard('${t.id}')"><div class="item-title">${esc(t.title)}</div><div class="tags">${tagHtml(t.tags)}</div><div class="item-meta">Start ${fmtTime(t.startedAt)} · Done ${fmtTime(t.completedAt)} · ${n.done}/${n.all} 子任务</div>${t.dueAt?`<span class="micro-due ${dueClass(t.dueAt)}">${dueText(t.dueAt)}</span>`:''}</div></div>${kanbanMiniActions(t)}${t.showMemo&&t.html?`<div class="rich-preview compact-preview">${t.html}</div>`:''}${n.all?`<div class="sub-list">${taskQuickTree(t.checks,'kanban',t.id)}</div>`:''}</div>`}
function renderKanban(){ensureRecurringKanban();const cols=state.kanbanColumns;$('#page-kanban').innerHTML=`<div class="section-title"><h2>Kanban</h2><div><button class="ghost-btn" onclick="createFromKanbanTemplate()">📋 从模板</button> <button class="ghost-btn" onclick="addKanbanColumn()">＋ 新列</button> <button class="primary-btn" onclick="openKanbanCard()">＋ 新建卡片</button></div></div><div class="filterbar"><input placeholder="按标题 / 标签筛选" value="${esc(kanbanFilter)}" oninput="kanbanFilter=this.value;renderKanban()"></div><div class="kanban">${cols.map(c=>`<div class="kanban-col" ondragover="event.preventDefault()" ondrop="dropTask(event,'${c.id}')"><div class="kanban-col-head"><h3>${esc(c.name)}</h3><span><button class="icon-btn" title="左移" onclick="moveKanbanColumn('${c.id}',-1)">←</button><button class="icon-btn" title="右移" onclick="moveKanbanColumn('${c.id}',1)">→</button><button class="icon-btn" title="列设置" onclick="renameKanbanColumn('${c.id}')">⋯</button></span></div>${state.kanban.filter(x=>x.status===c.id).filter(k=>!kanbanFilter||k.title.toLowerCase().includes(kanbanFilter.toLowerCase())||(k.tags||[]).some(t=>t.toLowerCase().includes(kanbanFilter.toLowerCase()))).map(cardHtml).join('')}</div>`).join('')}</div><div class="card" style="margin-top:18px"><div class="section-title"><h2>📅 Kanban 日历 / 历史</h2><span class="muted">按实际完成、预计或开始日期显示</span></div>${calendarModule(kanbanCalMonth,kanbanCalendarItems(),'kanbanCalendarShift')}</div>`}
function openKanbanCard(id){const t=state.kanban.find(x=>x.id===id)||{id:'',title:'',status:state.kanbanColumns[0]?.id||'todo',html:'',checks:[],tags:[],startedAt:null,completedAt:null,dueAt:'',showMemo:false};const merged=mergeTasksIntoHtml(t.html,t.checks||[]);drawer(`<div class="drawer-head"><div><h2 style="margin:0">${id?esc(t.title):'新建 Kanban 卡片'}</h2><div class="item-meta">实际开始 ${fmtTime(t.startedAt)} · 实际完成 ${fmtTime(t.completedAt)}</div></div><button class="ghost-btn" onclick="closeDrawer()">✕</button></div><div class="detail-grid"><div class="form-field"><label>标题</label><input id="kcTitle" value="${esc(t.title)}"></div><div class="form-field"><label>状态</label><select id="kcStatus">${state.kanbanColumns.map(c=>`<option value="${c.id}" ${t.status===c.id?'selected':''}>${esc(c.name)}</option>`).join('')}</select></div></div><div class="detail-grid compact-fields"><div class="form-field"><label>预计完成</label><input type="datetime-local" id="kcDue" value="${esc(t.dueAt||'')}"></div><div class="form-field"><label>标签</label><input id="kcTags" value="${esc((t.tags||[]).join(', '))}"></div></div><h3>Memo / 作业说明</h3><div class="item-meta">☑ 可继续添加下级子任务；子任务右侧 “＋↳” 可无限分层。</div>${richEditor('kanbanRich',merged,'文字、任务、图片、链接可混排…')}<div id="kanbanDrop" class="drop-zone">Ctrl+V 或拖图片到编辑框</div><div class="modal-actions">${id?`<button class="icon-btn footer-icon" title="模板" onclick="saveKanbanTemplate('${t.id}')">☆</button><button class="icon-btn footer-icon" title="定期重复" onclick="openRepeatModal('${t.id}')">🔁</button><button class="danger-btn" onclick="deleteKanban('${t.id}')">删除</button>`:''}<button class="primary-btn" onclick="saveKanbanDrawer('${t.id}')">保存</button></div>`);wireImageDrop('kanbanDrop','kanbanRich')}
async function saveKanbanDrawer(id){let t=id?state.kanban.find(x=>x.id===id):{id:uid(),startedAt:null,completedAt:null,showMemo:false};const tasks=collectInlineTasks('kanbanRich');Object.assign(t,{title:$('#kcTitle').value.trim(),status:$('#kcStatus').value,tags:splitTags($('#kcTags').value),html:$('#kanbanRich').innerHTML,checks:tasks,dueAt:$('#kcDue').value});if(tasksAllDone(tasks)&&!t.completedAt){if(!t.startedAt)t.startedAt=Date.now();t.completedAt=Date.now();t.status=state.kanbanColumns.find(c=>c.name.toUpperCase()==='DONE')?.id||'done'}if(!id)state.kanban.push(t);const rule=state.kanbanRecurring.find(r=>r.sourceCardId===t.id);if(rule)rule.snapshot=recurringSnapshotFromCard(t);await saveState();closeDrawer();renderKanban()}

function routineItem(r,d){const log=getRLog(d,r.id),st=log?.status||'';return `<div class="item"><div class="item-row"><div><div class="item-title">${esc(r.name)}</div><div class="tags">${tagHtml(r.tags)}</div><div class="item-meta">${log?.completedAt?'主任务完成 '+fmtTime(log.completedAt):'主任务未完成'}</div></div><div class="status-group"><button class="status-btn done ${st==='done'?'active':''}" onclick="setRoutineStatus('${d}','${r.id}','done')">✅完成</button><button class="status-btn leave ${st==='leave'?'active':''}" onclick="setRoutineStatus('${d}','${r.id}','leave')">🏖休假</button><button class="status-btn na ${st==='na'?'active':''}" onclick="setRoutineStatus('${d}','${r.id}','na')">➖N/A</button><button class="status-btn miss ${st==='miss'?'active':''}" onclick="setRoutineStatus('${d}','${r.id}','miss')">✕未完成</button></div></div>${(r.subtasks||[]).map(s=>{const sl=log?.subtasks?.[s.id];return `<label class="checkbox-line subtask"><input type="checkbox" ${sl?.done?'checked':''} onchange="toggleRoutineSub('${d}','${r.id}','${s.id}',this.checked)"><span>${esc(s.title)}</span><span class="item-meta">${sl?.completedAt?fmtTime(sl.completedAt):''}</span></label>`}).join('')}</div>`}
function openRoutineModal(id){const r=state.routines.find(x=>x.id===id)||{name:'',repeat:'weekdays',weekdays:[1,2,3,4,5],subtasks:[],tags:[]};modal(`<h2>${id?'编辑':'新建'} Routine</h2><div class="form-row"><div class="form-field"><label>名称</label><input id="rName" value="${esc(r.name)}"></div><div class="form-field"><label>标签</label><input id="rTags" value="${esc((r.tags||[]).join(', '))}"></div></div><div class="form-field"><label>重复</label><select id="rRepeat"><option value="daily" ${r.repeat==='daily'?'selected':''}>每天</option><option value="weekdays" ${r.repeat==='weekdays'?'selected':''}>工作日</option><option value="custom" ${r.repeat==='custom'?'selected':''}>指定星期</option></select></div><div>${['日','一','二','三','四','五','六'].map((n,i)=>`<label class="checkbox-line"><input type="checkbox" class="rWeek" value="${i}" ${(r.weekdays||[]).includes(i)?'checked':''}>周${n}</label>`).join('')}</div><h3>子任务</h3><div id="rSubs">${(r.subtasks||[]).map(s=>`<div class="item rsub" data-id="${s.id}"><input class="rsub-title" value="${esc(s.title)}"><button class="danger-btn" onclick="this.parentElement.remove()">删除</button></div>`).join('')}</div><button class="small-btn" onclick="$('#rSubs').insertAdjacentHTML('beforeend','<div class=&quot;item rsub&quot; data-id=&quot;${uid()}&quot;><input class=&quot;rsub-title&quot;><button class=&quot;danger-btn&quot; onclick=&quot;this.parentElement.remove()&quot;>删除</button></div>')">＋子任务</button><div class="modal-actions"><button class="ghost-btn" onclick="closeModal()">取消</button><button class="primary-btn" onclick="saveRoutine('${id||''}')">保存</button></div>`)}
async function saveRoutine(id){const x={id:id||uid(),name:$('#rName').value.trim(),tags:splitTags($('#rTags').value),repeat:$('#rRepeat').value,weekdays:$$('.rWeek:checked').map(x=>+x.value),subtasks:$$('.rsub').map(e=>({id:e.dataset.id,title:e.querySelector('.rsub-title').value.trim()})).filter(x=>x.title)};if(id)state.routines[state.routines.findIndex(r=>r.id===id)]={...state.routines.find(r=>r.id===id),...x};else state.routines.push(x);await saveState();closeModal();renderAll()}

function projectSummary(p){const n=countTasks(p.subtasks||[]);return `<div class="item project-row"><div class="card-topline"><input class="main-check" type="checkbox" ${p.completedAt?'checked':''} onchange="event.stopPropagation();finishProject('${p.id}',this.checked)"><div class="card-body" onclick="openProject('${p.id}')"><div class="item-title">${esc(p.title)}</div><div class="item-meta">${esc(p.status||'doing')} · Start ${fmtTime(p.startedAt)} · Done ${fmtTime(p.completedAt)} · ${n.done}/${n.all} 子任务</div><div class="tags">${tagHtml(p.tags)}</div></div></div>${!p.startedAt?`<button class="icon-btn" title="Start" onclick="event.stopPropagation();startProject('${p.id}')">▶</button>`:''}${n.all?`<div class="sub-list">${taskQuickTree(p.subtasks,'project',p.id)}</div>`:''}</div>`}
function openProject(id){const p=state.projects.find(x=>x.id===id);if(!p)return;drawer(`<div class="drawer-head"><div><h2 style="margin:0">${esc(p.title)}</h2><div class="item-meta">实际开始 ${fmtTime(p.startedAt)} · 实际完成 ${fmtTime(p.completedAt)}</div><div class="tags">${tagHtml(p.tags)}</div></div><button class="ghost-btn" onclick="closeDrawer()">✕</button></div><div class="mini-actions" style="margin-top:10px">${!p.startedAt?`<button class="icon-btn" title="Start 主任务" onclick="startProject('${p.id}')">▶</button>`:''}<button class="icon-btn" title="完成主任务" onclick="finishProject('${p.id}',true)">✓</button></div><div class="detail-grid"><div class="form-field"><label>标题</label><input id="pdTitle" value="${esc(p.title)}"></div><div class="form-field"><label>分类</label><select id="pdCat"><option value="">未分类</option>${state.projectCategories.map(c=>`<option value="${c.id}" ${p.categoryId===c.id?'selected':''}>${esc(c.name)}</option>`).join('')}</select></div></div><div class="detail-grid compact-fields"><div class="form-field"><label>预计完成</label><input type="datetime-local" id="pdDue" value="${esc(p.dueAt||'')}"></div><div class="form-field"><label>状态</label><select id="pdStatus"><option value="todo" ${p.status==='todo'?'selected':''}>TODO</option><option value="doing" ${p.status==='doing'?'selected':''}>DOING</option><option value="waiting" ${p.status==='waiting'?'selected':''}>WAITING</option><option value="done" ${p.status==='done'?'selected':''}>DONE</option></select></div></div><div class="form-field"><label>标签</label><input id="pdTags" value="${esc((p.tags||[]).join(', '))}"></div><h3>项目 Memo / 任务层级</h3>${richEditor('projectRich',mergeTasksIntoHtml(p.html,p.subtasks||[]),'可在任意位置插任务，任务内可继续 +↳ 添加下级任务…')}<div id="projectDrop" class="drop-zone">Ctrl+V 或拖图片</div>${richNoteSection('交接 / 对接人员','handoffs',p)}${richNoteSection('汇报记录','reports',p)}${richNoteSection('被提出的问题','questions',p)}${richNoteSection('需要调查的地方','investigations',p)}<div class="modal-actions"><button class="danger-btn" onclick="deleteProject('${p.id}')">删除项目</button><button class="primary-btn" onclick="saveProjectDrawer('${p.id}')">保存</button></div>`);wireImageDrop('projectDrop','projectRich');['handoffs','reports','questions','investigations'].forEach(k=>(p[k]||[]).forEach(n=>wireImageDrop(`${k}Drop_${n.id}`,`${k}Rich_${n.id}`)))}
async function saveProjectDrawer(id){const p=state.projects.find(x=>x.id===id),tasks=collectInlineTasks('projectRich');Object.assign(p,{title:$('#pdTitle').value.trim(),categoryId:$('#pdCat').value,dueAt:$('#pdDue').value,status:$('#pdStatus').value,tags:splitTags($('#pdTags').value),html:$('#projectRich').innerHTML,subtasks:tasks,handoffs:collectRichNotes('handoffs'),reports:collectRichNotes('reports'),questions:collectRichNotes('questions'),investigations:collectRichNotes('investigations')});if(tasksAllDone(tasks)&&!p.completedAt){if(!p.startedAt)p.startedAt=Date.now();p.completedAt=Date.now();p.status='done'}await saveState();closeDrawer();renderProjects();toast('项目已保存')}

function globalTagResults(q){const s=q.trim().toLowerCase();if(!s)return[];const out=[];for(const r of state.routines)if((r.tags||[]).some(t=>t.toLowerCase().includes(s)))out.push({type:'routine',id:r.id,title:r.name,tags:r.tags});for(const p of state.projects)if((p.tags||[]).some(t=>t.toLowerCase().includes(s)))out.push({type:'project',id:p.id,title:p.title,tags:p.tags});for(const k of state.kanban)if((k.tags||[]).some(t=>t.toLowerCase().includes(s)))out.push({type:'kanban',id:k.id,title:k.title,tags:k.tags});for(const m of state.memos)if((m.tags||[]).some(t=>t.toLowerCase().includes(s)))out.push({type:'memo',id:m.id,title:m.title,tags:m.tags});return out}
function openGlobalResult(type,id){if(type==='project'){goPage('projects');setTimeout(()=>openProject(id),0)}else if(type==='kanban'){goPage('kanban');setTimeout(()=>openKanbanCard(id),0)}else if(type==='memo'){activeMemoId=id;goPage('memo')}else goPage('routine')}
function tagSearchModule(){const rs=globalTagResults(globalTagQuery);return `<div class="card tag-search"><div class="section-title"><h2>🏷 标签检索</h2><span class="muted">Routine / Projects / Kanban / Memo 共用</span></div><input placeholder="输入标签，例如 SAP、memory、AMO" value="${esc(globalTagQuery)}" oninput="globalTagQuery=this.value;renderToday()">${globalTagQuery?`<div class="tag-results">${rs.map(x=>`<button class="tag-result" onclick="openGlobalResult('${x.type}','${x.id}')"><span class="pill">${x.type}</span><b>${esc(x.title)}</b><span class="tags">${tagHtml(x.tags)}</span></button>`).join('')||'<div class="empty">没有匹配内容</div>'}</div>`:''}</div>`}
function renderToday(){ensureRecurringKanban();const d=todayISO(),rs=state.routines.filter(r=>isRoutineDue(r,d)),done=rs.filter(r=>getRLog(d,r.id)?.status==='done').length,activeP=state.projects.filter(p=>p.status!=='done'&&!p.completedAt),activeK=state.kanban.filter(x=>!x.completedAt&&String(x.status).toLowerCase()!=='done');const recentProjects=[...state.projects].sort((a,b)=>(b.createdAt||b.startedAt||0)-(a.createdAt||a.startedAt||0)).slice(0,6);$('#page-today').innerHTML=`<div class="grid grid-3"><button class="card kpi-link" onclick="goPage('routine')"><div class="kpi">${done}/${rs.length}</div><div class="kpi-label">今日 Routine →</div></button><button class="card kpi-link" onclick="goPage('projects')"><div class="kpi">${activeP.length}</div><div class="kpi-label">长期任务 / Projects →</div></button><button class="card kpi-link" onclick="goPage('kanban')"><div class="kpi">${activeK.length}</div><div class="kpi-label">Kanban 未完成 →</div></button></div><div class="grid grid-2" style="margin-top:18px"><div class="card"><div class="section-title"><h2>今日 Routine</h2><button class="small-btn" onclick="goPage('routine')">历史</button></div>${rs.map(r=>routineItem(r,d)).join('')}</div><div class="card"><div class="section-title"><h2>长期任务</h2><button class="small-btn" onclick="goPage('projects')">全部</button></div>${recentProjects.map(projectSummary).join('')||'<div class="empty">还没有长期任务</div>'}</div></div><div class="card" style="margin-top:18px"><div class="section-title"><h2>📊 Kanban</h2><button class="small-btn" onclick="goPage('kanban')">打开看板</button></div><div class="today-kanban-grid"><div>${activeK.slice(0,4).map(cardHtml).join('')||'<div class="empty">没有未完成卡片</div>'}</div><div>${calendarModule(todayCalMonth,kanbanCalendarItems(),'todayCalendarShift',true)}</div></div></div><div style="margin-top:18px">${tagSearchModule()}</div>`}

function sopStepEditorRow(s){const sid=s.id||uid(),eid=`sopRich_${sid}`;return `<div class="item sstep" data-id="${sid}"><div class="form-field"><label>步骤名称</label><input class="ss-title" value="${esc(s.title||'')}"></div><div class="form-field"><label>步骤说明 / Checklist / 图片</label>${richEditor(eid,s.noteHtml||'','可插入图片、Checkbox、链接、高亮…')}</div><button class="danger-btn" onclick="this.closest('.sstep').remove()">删除步骤</button></div>`}
function wireSopEditors(rootSel='.sstep'){document.querySelectorAll(rootSel).forEach(e=>wireImageDrop(null,`sopRich_${e.dataset.id}`))}
function openSopTemplate(id){const t=state.sopTemplates.find(x=>x.id===id)||{name:'',category:'',description:'',steps:[]};modal(`<h2>${id?'编辑':'新建'} SOP</h2><div class="form-row"><input id="sName" placeholder="名称" value="${esc(t.name)}"><input id="sCat" placeholder="分类" value="${esc(t.category||'')}"></div><textarea id="sDesc" placeholder="SOP 说明">${esc(t.description||'')}</textarea><h3>步骤</h3><div id="sSteps">${t.steps.map(sopStepEditorRow).join('')}</div><button class="small-btn" onclick="addSopStep()">＋ 步骤</button><div class="modal-actions"><button class="ghost-btn" onclick="closeModal()">取消</button><button class="primary-btn" onclick="saveSop('${id||''}')">保存</button></div>`);wireSopEditors()}
function addSopStep(){const s={id:uid(),title:'',noteHtml:''};$('#sSteps').insertAdjacentHTML('beforeend',sopStepEditorRow(s));wireImageDrop(null,`sopRich_${s.id}`)}
async function saveSop(id){const t={id:id||uid(),name:$('#sName').value.trim(),category:$('#sCat').value.trim(),description:$('#sDesc').value.trim(),links:[],steps:$$('.sstep').map(e=>({id:e.dataset.id,title:e.querySelector('.ss-title').value.trim(),noteHtml:e.querySelector(`#sopRich_${e.dataset.id}`).innerHTML,note:''})).filter(x=>x.title)};if(id)state.sopTemplates[state.sopTemplates.findIndex(x=>x.id===id)]=t;else state.sopTemplates.push(t);await saveState();closeModal();renderSOP()}
async function createExec(id){const t=state.sopTemplates.find(x=>x.id===id),e={id:uid(),templateId:id,templateName:t.name,date:$('#eDate').value,environment:$('#eEnv').value,note:$('#eNote').value,steps:t.steps.map(s=>({id:uid(),title:s.title,noteHtml:s.noteHtml||'',memoHtml:s.noteHtml||'',startedAt:null,completedAt:null})),createdAt:Date.now(),completedAt:null};state.executions.unshift(e);await saveState();closeModal();openExec(e.id)}
function saveExecEditors(eid){const e=state.executions.find(x=>x.id===eid);if(!e)return;(e.steps||[]).forEach(s=>{const ed=document.getElementById(`execRich_${s.id}`);if(ed)s.memoHtml=ed.innerHTML})}
function openExec(id){const e=state.executions.find(x=>x.id===id);if(!e)return;drawer(`<div class="drawer-head"><h2>${esc(e.templateName)}</h2><button class="ghost-btn" onclick="saveExecEditors('${e.id}');closeDrawer()">✕</button></div><div class="muted">${e.date} · ${esc(e.environment||'')}</div>${e.steps.map((s,i)=>`<div class="sop-step ${s.completedAt?'completed':s.startedAt?'running':''}"><div class="item-row"><b>${i+1}. ${esc(s.title)}</b><span class="item-meta">Start ${fmtTime(s.startedAt)} · Done ${fmtTime(s.completedAt)} · ⏱ ${s.startedAt?msToText((s.completedAt||Date.now())-s.startedAt):'-'}</span></div>${richEditor(`execRich_${s.id}`,s.memoHtml||s.noteHtml||'','执行记录、截图、checkbox…')}<div class="mini-actions">${!s.startedAt?`<button class="icon-btn" title="Start" onclick="saveExecEditors('${e.id}');startExecStep('${e.id}','${s.id}')">▶</button>`:!s.completedAt?`<button class="icon-btn" title="Complete" onclick="saveExecEditors('${e.id}');finishExecStep('${e.id}','${s.id}')">✓</button>`:''}</div></div>`).join('')}<div class="modal-actions"><button class="ghost-btn" onclick="saveExecEditors('${e.id}');saveState().then(()=>toast('已保存'))">保存</button><button class="primary-btn" onclick="saveExecEditors('${e.id}');finishExec('${e.id}')">完成整个作业</button></div>`);(e.steps||[]).forEach(s=>wireImageDrop(null,`execRich_${s.id}`))}

/* ======================= END V5 OVERRIDES ======================= */


/* ======================= V6 OVERRIDES ======================= */
let archiveViewQuery='';

function migrateV6(){
  state.routineTemplates??=[];
  state.projectTemplates??=[];
  state.memoTemplates??=[];
  state.kanbanTemplates??=[];
  state.kanbanRecurring??=[];
  (state.kanbanColumns||[]).forEach((c,i)=>{
    c.bgColor??=['#eef1f6','#eef1f6','#eef1f6','#eef1f6','#eef1f6'][i%5];
    c.cardColor??='#ffffff';
  });
  (state.kanban||[]).forEach(t=>{
    t.archived??=false;
    t.plannedStartAt??='';
    t.cardColor??='';
  });
  (state.kanbanTemplates||[]).forEach(t=>{t.plannedStartAt??='';t.dueAt??=''});
  (state.projects||[]).forEach(p=>{p.templateName??=''});
}
async function loadState(){
  await openDB();
  state=await dbGet('state');
  if(!state)state=structuredClone(DEFAULT);
  migrate();migrateV5();migrateV6();
  ensureRecurringKanban();
  await saveState();
}

/* ---------- navigation ---------- */
function goPage(n){
  $$('.page').forEach(x=>x.classList.remove('active'));
  const page=$(`#page-${n}`); if(page)page.classList.add('active');
  $$('.nav-item').forEach(x=>x.classList.toggle('active',x.dataset.page===n));
  $('#pageTitle').textContent=({
    today:'Today',routine:'Routine',projects:'Projects',sop:'SOP',
    history:'Execution History',kanban:'Kanban',memo:'Memo',
    templates:'Templates',settings:'Settings'
  })[n]||n;
  renderPage(n);
}
function renderPage(n){
  ({
    today:renderToday,routine:renderRoutine,projects:renderProjects,
    sop:renderSOP,history:renderHistory,kanban:renderKanban,
    memo:renderMemo,templates:renderTemplates,settings:renderSettings
  }[n]||(()=>{}))();
}

/* ---------- column/card colors ---------- */
function columnForCard(t){return state.kanbanColumns.find(c=>c.id===t.status)}
function cardColorFor(t,c){
  if(t.completedAt || String(c?.name||'').toUpperCase()==='DONE')return '#eeeeef';
  return t.cardColor || c?.cardColor || '#ffffff';
}
function renameKanbanColumn(id){
  const c=state.kanbanColumns.find(x=>x.id===id); if(!c)return;
  modal(`<h2>列设置</h2>
    <div class="form-field"><label>列名称</label><input id="colName" value="${esc(c.name)}"></div>
    <div class="form-row">
      <div class="form-field"><label>列背景</label><input id="colBg" type="color" value="${esc(c.bgColor||'#eef1f6')}"></div>
      <div class="form-field"><label>卡片背景</label><input id="colCard" type="color" value="${esc(c.cardColor||'#ffffff')}"></div>
    </div>
    <div class="modal-actions"><button class="ghost-btn" onclick="closeModal()">取消</button><button class="primary-btn" onclick="saveColumnSettings('${id}')">保存</button></div>`);
}
async function saveColumnSettings(id){
  const c=state.kanbanColumns.find(x=>x.id===id);if(!c)return;
  c.name=$('#colName').value.trim()||c.name;
  c.bgColor=$('#colBg').value;c.cardColor=$('#colCard').value;
  await saveState();closeModal();renderKanban();
}

/* ---------- compact kanban cards ---------- */
function taskQuickTree(tasks,ownerType,ownerId,depth=0){
  return (tasks||[]).map(t=>`<div class="sub-inline nested-${Math.min(depth,5)}">
    <input type="checkbox" ${t.done||t.completedAt?'checked':''} onchange="toggleQuickTask('${ownerType}','${ownerId}','${t.id}',this.checked)">
    <span class="sub-name">${depth?'<span class="tree-branch">↳</span> ':''}${esc(t.text||t.title)}</span>
    ${!t.startedAt?`<button class="micro-btn" title="Start" onclick="startQuickTask('${ownerType}','${ownerId}','${t.id}')">▶</button>`:`<span class="micro-time">${fmtTime(t.startedAt)}${t.completedAt?'→'+fmtTime(t.completedAt):''}</span>`}
    ${t.dueAt?`<span class="micro-due ${dueClass(t.dueAt)}">${dueText(t.dueAt)}</span>`:''}
  </div>${taskQuickTree(t.children||[],ownerType,ownerId,depth+1)}`).join('');
}
function kanbanMiniActions(t){
  const canArchive=!!t.completedAt || String(columnForCard(t)?.name||'').toUpperCase()==='DONE';
  return `<div class="mini-actions card-corner-actions">
    ${!t.startedAt?`<button class="icon-btn" title="Start" onclick="event.stopPropagation();startKanbanTask('${t.id}')">▶</button>`:''}
    <button class="icon-btn" title="${t.showMemo?'隐藏':'显示'} Memo" onclick="event.stopPropagation();toggleCardMemo('${t.id}')">${t.showMemo?'🙈':'👁'}</button>
    <button class="icon-btn" title="保存为模板" onclick="event.stopPropagation();saveKanbanTemplate('${t.id}')">☆</button>
    <button class="icon-btn" title="定期重复" onclick="event.stopPropagation();openRepeatModal('${t.id}')">🔁</button>
    ${canArchive?`<button class="icon-btn" title="归档" onclick="event.stopPropagation();archiveKanban('${t.id}')">📦</button>`:''}
  </div>`;
}
function cardHtml(t,c=null){
  c=c||columnForCard(t);
  const n=countTasks(t.checks||[]);
  const search=((t.title||'')+' '+(t.tags||[]).join(' ')).toLowerCase();
  return `<div class="task-card ${t.completedAt?'done-card':''}" data-search="${esc(search)}" draggable="true"
    style="background:${cardColorFor(t,c)}"
    ondragstart="event.dataTransfer.setData('text/plain','${t.id}')">
    ${kanbanMiniActions(t)}
    <div class="card-topline">
      <input class="main-check" type="checkbox" ${t.completedAt?'checked':''} onclick="event.stopPropagation()" onchange="finishKanbanTask('${t.id}',this.checked)">
      <div class="card-body" onclick="openKanbanCard('${t.id}')">
        <div class="item-title">${esc(t.title)}</div>
        <div class="tags">${tagHtml(t.tags)}</div>
        <div class="item-meta">Start ${fmtTime(t.startedAt)} · Done ${fmtTime(t.completedAt)} · ${n.done}/${n.all} 子任务</div>
        ${t.plannedStartAt?`<span class="micro-due">计划开始 ${esc(t.plannedStartAt.replace('T',' '))}</span>`:''}
        ${t.dueAt?`<span class="micro-due ${dueClass(t.dueAt)}">${dueText(t.dueAt)}</span>`:''}
      </div>
    </div>
    ${t.showMemo&&t.html?`<div class="rich-preview compact-preview">${t.html}</div>`:''}
    ${n.all?`<div class="sub-list">${taskQuickTree(t.checks,'kanban',t.id)}</div>`:''}
  </div>`;
}

/* ---------- filter without rerender ---------- */
function filterKanbanVisible(v){
  kanbanFilter=v||'';
  const q=kanbanFilter.trim().toLowerCase();
  document.querySelectorAll('#page-kanban .task-card').forEach(el=>{
    el.style.display=(!q || (el.dataset.search||'').includes(q))?'':'none';
  });
}

/* ---------- archive ---------- */
async function archiveKanban(id){
  const t=state.kanban.find(x=>x.id===id);if(!t)return;
  t.archived=true;await saveState();renderKanban();toast('已归档');
}
async function restoreKanban(id){
  const t=state.kanban.find(x=>x.id===id);if(!t)return;
  t.archived=false;await saveState();openArchive();
}
async function permanentlyDeleteKanban(id){
  if(!confirm('永久删除这张已归档卡片？'))return;
  state.kanban=state.kanban.filter(x=>x.id!==id);await saveState();openArchive();
}
function openArchive(){
  const rows=state.kanban.filter(x=>x.archived).filter(x=>!archiveViewQuery||x.title.toLowerCase().includes(archiveViewQuery.toLowerCase()));
  modal(`<h2>📦 Kanban 归档</h2>
    <input placeholder="搜索归档" value="${esc(archiveViewQuery)}" oninput="archiveViewQuery=this.value;openArchive()">
    <div class="list" style="margin-top:12px">${rows.map(t=>`<div class="item"><div class="item-row"><div><b>${esc(t.title)}</b><div class="item-meta">Done ${fmtTime(t.completedAt)}</div></div><div><button class="small-btn" onclick="restoreKanban('${t.id}')">恢复</button> <button class="danger-btn" onclick="permanentlyDeleteKanban('${t.id}')">删除</button></div></div></div>`).join('')||'<div class="empty">没有归档内容</div>'}</div>
    <div class="modal-actions"><button class="ghost-btn" onclick="closeModal()">关闭</button></div>`);
}

/* ---------- yearly recurrence ---------- */
function recurrenceKey(rule,d=new Date()){
  const y=d.getFullYear(),m=String(d.getMonth()+1).padStart(2,'0');
  if(rule.frequency==='daily')return d.toISOString().slice(0,10);
  if(rule.frequency==='weekly'){
    const x=new Date(d);x.setDate(d.getDate()-((d.getDay()+6)%7));
    return x.toISOString().slice(0,10);
  }
  if(rule.frequency==='yearly')return String(y);
  return `${y}-${m}`;
}
function recurrenceDue(rule,d=new Date()){
  if(rule.frequency==='daily')return true;
  if(rule.frequency==='weekly')return d.getDay()===Number(rule.weekday||1);
  if(rule.frequency==='yearly'){
    const m=d.getMonth()+1, targetM=Number(rule.monthOfYear||1), day=Number(rule.dayOfMonth||1);
    return m>targetM || (m===targetM && d.getDate()>=day);
  }
  return d.getDate()>=Number(rule.dayOfMonth||1);
}
function openRepeatModal(id){
  const t=state.kanban.find(x=>x.id===id);if(!t)return;
  const r=state.kanbanRecurring.find(x=>x.sourceCardId===id)||{frequency:'monthly',dayOfMonth:1,monthOfYear:1,weekday:1,targetColumnId:t.status,enabled:true};
  modal(`<h2>🔁 定期重复</h2>
    <div class="form-field"><label>频率</label><select id="repFreq">
      <option value="daily" ${r.frequency==='daily'?'selected':''}>每天</option>
      <option value="weekly" ${r.frequency==='weekly'?'selected':''}>每周</option>
      <option value="monthly" ${r.frequency==='monthly'?'selected':''}>每月</option>
      <option value="yearly" ${r.frequency==='yearly'?'selected':''}>每年</option>
    </select></div>
    <div class="form-row">
      <div class="form-field"><label>月份（每年时 1-12）</label><input id="repMonth" type="number" min="1" max="12" value="${r.monthOfYear||1}"></div>
      <div class="form-field"><label>每月几日 / 每年几日</label><input id="repDay" type="number" min="1" max="31" value="${r.dayOfMonth||1}"></div>
    </div>
    <div class="form-field"><label>星期（每周时 0=日, 1=一 … 6=六）</label><input id="repWeek" type="number" min="0" max="6" value="${r.weekday??1}"></div>
    <div class="form-field"><label>自动生成到哪一列</label><select id="repCol">${state.kanbanColumns.map(c=>`<option value="${c.id}" ${r.targetColumnId===c.id?'selected':''}>${esc(c.name)}</option>`).join('')}</select></div>
    <label class="checkbox-line"><input id="repEnabled" type="checkbox" ${r.enabled!==false?'checked':''}>启用</label>
    <div class="modal-actions"><button class="ghost-btn" onclick="closeModal()">取消</button><button class="primary-btn" onclick="saveRepeatRule('${id}')">保存</button></div>`);
}
async function saveRepeatRule(id){
  const t=state.kanban.find(x=>x.id===id);let r=state.kanbanRecurring.find(x=>x.sourceCardId===id);
  if(!r){r={id:uid(),sourceCardId:id};state.kanbanRecurring.push(r)}
  Object.assign(r,{
    name:t.title,frequency:$('#repFreq').value,
    monthOfYear:+$('#repMonth').value||1,dayOfMonth:+$('#repDay').value||1,
    weekday:+$('#repWeek').value||1,targetColumnId:$('#repCol').value,
    enabled:$('#repEnabled').checked,snapshot:recurringSnapshotFromCard(t)
  });
  ensureRecurringKanban();await saveState();closeModal();renderKanban();toast('定期重复已保存');
}
function ensureRecurringKanban(){
  let changed=false;const now=new Date();
  for(const r of state.kanbanRecurring||[]){
    if(!r.enabled||!recurrenceDue(r,now))continue;
    const key=recurrenceKey(r,now);if(r.lastGeneratedKey===key)continue;
    const snap=r.snapshot||{};
    const day=String(now.getDate()).padStart(2,'0'),mon=String(now.getMonth()+1).padStart(2,'0');
    const card={
      id:uid(),title:snap.title||r.name||'定期任务',
      status:r.targetColumnId||state.kanbanColumns[0]?.id||'todo',
      html:snap.html||'',checks:clearTaskTimes(snap.checks||[]),images:[],
      tags:[...(snap.tags||[])],startedAt:null,completedAt:null,dueAt:'',
      plannedStartAt:`${now.getFullYear()}-${mon}-${day}T09:00`,
      showMemo:false,archived:false,recurrenceRuleId:r.id,generatedKey:key,createdAt:Date.now()
    };
    card.html=mergeTasksIntoHtml(card.html,card.checks);
    state.kanban.push(card);r.lastGeneratedKey=key;changed=true;
  }return changed;
}

/* ---------- planned start ---------- */
function openKanbanCard(id){
  const t=state.kanban.find(x=>x.id===id)||{
    id:'',title:'',status:state.kanbanColumns[0]?.id||'todo',html:'',checks:[],tags:[],
    startedAt:null,completedAt:null,plannedStartAt:'',dueAt:'',showMemo:false,archived:false
  };
  const merged=mergeTasksIntoHtml(t.html,t.checks||[]);
  drawer(`<div class="drawer-head"><div><h2 style="margin:0">${id?esc(t.title):'新建 Kanban 卡片'}</h2><div class="item-meta">实际开始 ${fmtTime(t.startedAt)} · 实际完成 ${fmtTime(t.completedAt)}</div></div><button class="ghost-btn" onclick="closeDrawer()">✕</button></div>
    <div class="detail-grid"><div class="form-field"><label>标题</label><input id="kcTitle" value="${esc(t.title)}"></div><div class="form-field"><label>状态</label><select id="kcStatus">${state.kanbanColumns.map(c=>`<option value="${c.id}" ${t.status===c.id?'selected':''}>${esc(c.name)}</option>`).join('')}</select></div></div>
    <div class="detail-grid compact-fields"><div class="form-field"><label>预计开始</label><input type="datetime-local" id="kcPlanned" value="${esc(t.plannedStartAt||'')}"></div><div class="form-field"><label>预计完成</label><input type="datetime-local" id="kcDue" value="${esc(t.dueAt||'')}"></div></div>
    <div class="form-field"><label>标签</label><input id="kcTags" value="${esc((t.tags||[]).join(', '))}"></div>
    <h3>Memo / 作业说明</h3><div class="item-meta">☑ 子任务可以继续 +↳ 添加下级子任务。</div>
    ${richEditor('kanbanRich',merged,'文字、任务、图片、链接可混排…')}
    <div id="kanbanDrop" class="drop-zone">Ctrl+V 或拖图片到编辑框</div>
    <div class="modal-actions">${id?`<button class="icon-btn footer-icon" title="保存为模板" onclick="saveKanbanTemplate('${t.id}')">☆</button><button class="icon-btn footer-icon" title="定期重复" onclick="openRepeatModal('${t.id}')">🔁</button><button class="danger-btn" onclick="deleteKanban('${t.id}')">删除</button>`:''}<button class="primary-btn" onclick="saveKanbanDrawer('${t.id}')">保存</button></div>`);
  wireImageDrop('kanbanDrop','kanbanRich');
}
async function saveKanbanDrawer(id){
  let t=id?state.kanban.find(x=>x.id===id):{id:uid(),images:[],startedAt:null,completedAt:null,showMemo:false,archived:false};
  const tasks=collectInlineTasks('kanbanRich');
  Object.assign(t,{
    title:$('#kcTitle').value.trim(),status:$('#kcStatus').value,tags:splitTags($('#kcTags').value),
    html:$('#kanbanRich').innerHTML,checks:tasks,plannedStartAt:$('#kcPlanned').value,dueAt:$('#kcDue').value
  });
  if(tasksAllDone(tasks)&&!t.completedAt){
    if(!t.startedAt)t.startedAt=Date.now();t.completedAt=Date.now();
    t.status=state.kanbanColumns.find(c=>String(c.name).toUpperCase()==='DONE')?.id||'done';
  }
  if(!id)state.kanban.push(t);
  await saveState();closeDrawer();renderKanban();
}

/* ---------- calendar ---------- */
function taskDate(t){
  if(t.plannedStartAt)return new Date(t.plannedStartAt);
  if(t.completedAt)return new Date(t.completedAt);
  if(t.dueAt)return new Date(t.dueAt);
  if(t.startedAt)return new Date(t.startedAt);
  return null;
}
function kanbanCalendarItems(){
  return state.kanban.map(t=>({id:t.id,title:t.title,date:taskDate(t),done:!!t.completedAt,archived:!!t.archived}));
}
function calendarModule(monthKey,items,onShiftName,compact=false){
  const [y,m]=monthKey.split('-').map(Number),first=new Date(y,m-1,1),last=new Date(y,m,0),start=first.getDay();
  let cells=['日','一','二','三','四','五','六'].map(x=>`<div class="cal-week">${x}</div>`);
  for(let i=0;i<start;i++)cells.push('<div class="cal-day blank"></div>');
  for(let day=1;day<=last.getDate();day++){
    const ds=`${y}-${String(m).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
    let hits=items.filter(x=>x.date&&x.date.toISOString().slice(0,10)===ds);
    hits.sort((a,b)=>Number(a.done)-Number(b.done));
    const events=hits.map(h=>`<button class="cal-event ${h.done?'done':''}" title="${esc(h.title)}" onclick="openKanbanCard('${h.id}')">${h.done?'✓ ':''}${esc(h.title)}</button>`).join('');
    cells.push(`<div class="cal-day ${ds===todayISO()?'today':''}"><div class="cal-num">${day}</div><div class="cal-events-scroll">${events||''}</div></div>`);
  }
  return `<div class="calendar-card"><div class="cal-head"><button class="micro-btn" onclick="${onShiftName}(-1)">‹</button><b>${y}年${m}月</b><button class="micro-btn" onclick="${onShiftName}(1)">›</button></div><div class="calendar-v5">${cells.join('')}</div></div>`;
}

/* ---------- render kanban ---------- */
function renderKanban(){
  ensureRecurringKanban();
  const cols=state.kanbanColumns, archivedCount=state.kanban.filter(x=>x.archived).length;
  $('#page-kanban').innerHTML=`<div class="section-title"><h2>Kanban</h2><div>
    <button class="ghost-btn" onclick="goPage('templates')">🧩 模板库</button>
    <button class="ghost-btn" onclick="openArchive()">📦 归档 ${archivedCount?`(${archivedCount})`:''}</button>
    <button class="ghost-btn" onclick="addKanbanColumn()">＋ 新列</button>
    <button class="primary-btn" onclick="openKanbanCard()">＋ 新建卡片</button>
  </div></div>
  <div class="filterbar"><input id="kanbanFilterInput" placeholder="按标题 / 标签筛选" value="${esc(kanbanFilter)}" oninput="filterKanbanVisible(this.value)"></div>
  <div class="kanban">${cols.map(c=>`<div class="kanban-col" style="background:${esc(c.bgColor||'#eef1f6')}" ondragover="event.preventDefault()" ondrop="dropTask(event,'${c.id}')">
    <div class="kanban-col-head"><h3>${esc(c.name)}</h3><span><button class="icon-btn" title="左移" onclick="moveKanbanColumn('${c.id}',-1)">←</button><button class="icon-btn" title="右移" onclick="moveKanbanColumn('${c.id}',1)">→</button><button class="icon-btn" title="列设置 / 颜色" onclick="renameKanbanColumn('${c.id}')">⋯</button></span></div>
    ${state.kanban.filter(x=>x.status===c.id&&!x.archived).map(t=>cardHtml(t,c)).join('')}
  </div>`).join('')}</div>
  <div class="card" style="margin-top:18px"><div class="section-title"><h2>📅 Kanban 日历 / 历史</h2><span class="muted">未完成在上，完成在下；格内可上下滚动</span></div>${calendarModule(kanbanCalMonth,kanbanCalendarItems(),'kanbanCalendarShift')}</div>`;
  setTimeout(()=>filterKanbanVisible(kanbanFilter),0);
}

/* ---------- template snapshots ---------- */
function cloneRoutineSnapshot(r){return{name:r.name,tags:[...(r.tags||[])],repeat:r.repeat,weekdays:[...(r.weekdays||[])],subtasks:(r.subtasks||[]).map(s=>({id:uid(),title:s.title}))}}
function cloneProjectSnapshot(p){return{title:p.title,categoryId:p.categoryId||'',tags:[...(p.tags||[])],html:p.html||'',subtasks:clearTaskTimes(p.subtasks||[]),handoffs:structuredClone(p.handoffs||[]),reports:structuredClone(p.reports||[]),questions:structuredClone(p.questions||[]),investigations:structuredClone(p.investigations||[])}}
function cloneMemoSnapshot(m){return{title:m.title,tags:[...(m.tags||[])],html:m.html||'',checks:structuredClone(m.checks||[]),images:structuredClone(m.images||[])}}

async function saveRoutineAsTemplate(id){
  const r=state.routines.find(x=>x.id===id);if(!r)return;const name=prompt('模板名称',r.name);if(!name)return;
  state.routineTemplates.push({id:uid(),name,snapshot:cloneRoutineSnapshot(r),createdAt:Date.now()});await saveState();toast('Routine 模板已保存');
}
async function saveProjectAsTemplate(id){
  const p=state.projects.find(x=>x.id===id);if(!p)return;const name=prompt('模板名称',p.title);if(!name)return;
  state.projectTemplates.push({id:uid(),name,snapshot:cloneProjectSnapshot(p),createdAt:Date.now()});await saveState();toast('Project 模板已保存');
}
async function saveMemoAsTemplate(id){
  const m=state.memos.find(x=>x.id===id);if(!m)return;const name=prompt('模板名称',m.title);if(!name)return;
  state.memoTemplates.push({id:uid(),name,snapshot:cloneMemoSnapshot(m),createdAt:Date.now()});await saveState();toast('Memo 模板已保存');
}

/* ---------- routine template hooks ---------- */
function renderRoutine(){
  const due=state.routines.filter(r=>isRoutineDue(r,routineViewDate));
  $('#page-routine').innerHTML=`<div class="card"><div class="section-title"><h2>Daily Routine</h2><div><button class="ghost-btn" onclick="goPage('templates')">🧩 模板库</button> <button class="primary-btn" onclick="openRoutineModal()">＋ 新建 Routine</button></div></div>
    <div class="form-row"><div class="form-field"><label>查看日期</label><input type="date" value="${routineViewDate}" onchange="routineViewDate=this.value;renderRoutine()"></div><div class="item">${fmtDate(routineViewDate)}</div></div>
    <div class="list" style="margin-top:14px">${due.map(r=>routineItem(r,routineViewDate)).join('')}</div></div>
    <div class="card" style="margin-top:18px"><h2>Routine 管理</h2>${state.routines.map(r=>`<div class="item"><div class="item-row"><div><b>${esc(r.name)}</b><div class="tags">${tagHtml(r.tags)}</div><div class="item-meta">${repeatText(r)} · ${(r.subtasks||[]).length} 个子任务</div></div><div><button class="small-btn" onclick="saveRoutineAsTemplate('${r.id}')">☆ 模板</button> <button class="small-btn" onclick="openRoutineModal('${r.id}')">编辑</button></div></div></div>`).join('')}</div>`;
}

/* ---------- project template hook ---------- */
function openProject(id){
  const p=state.projects.find(x=>x.id===id);if(!p)return;
  drawer(`<div class="drawer-head"><div><h2 style="margin:0">${esc(p.title)}</h2><div class="item-meta">实际开始 ${fmtTime(p.startedAt)} · 实际完成 ${fmtTime(p.completedAt)}</div><div class="tags">${tagHtml(p.tags)}</div></div><button class="ghost-btn" onclick="closeDrawer()">✕</button></div>
    <div class="mini-actions" style="margin-top:10px">${!p.startedAt?`<button class="icon-btn" title="Start 主任务" onclick="startProject('${p.id}')">▶</button>`:''}<button class="icon-btn" title="完成主任务" onclick="finishProject('${p.id}',true)">✓</button><button class="icon-btn" title="保存为模板" onclick="saveProjectAsTemplate('${p.id}')">☆</button></div>
    <div class="detail-grid"><div class="form-field"><label>标题</label><input id="pdTitle" value="${esc(p.title)}"></div><div class="form-field"><label>分类</label><select id="pdCat"><option value="">未分类</option>${state.projectCategories.map(c=>`<option value="${c.id}" ${p.categoryId===c.id?'selected':''}>${esc(c.name)}</option>`).join('')}</select></div></div>
    <div class="detail-grid compact-fields"><div class="form-field"><label>预计完成</label><input type="datetime-local" id="pdDue" value="${esc(p.dueAt||'')}"></div><div class="form-field"><label>状态</label><select id="pdStatus"><option value="todo" ${p.status==='todo'?'selected':''}>TODO</option><option value="doing" ${p.status==='doing'?'selected':''}>DOING</option><option value="waiting" ${p.status==='waiting'?'selected':''}>WAITING</option><option value="done" ${p.status==='done'?'selected':''}>DONE</option></select></div></div>
    <div class="form-field"><label>标签</label><input id="pdTags" value="${esc((p.tags||[]).join(', '))}"></div>
    <h3>项目 Memo / 任务层级</h3>${richEditor('projectRich',mergeTasksIntoHtml(p.html,p.subtasks||[]),'可在任意位置插任务，任务内可继续 +↳ 添加下级任务…')}
    <div id="projectDrop" class="drop-zone">Ctrl+V 或拖图片</div>${richNoteSection('交接 / 对接人员','handoffs',p)}${richNoteSection('汇报记录','reports',p)}${richNoteSection('被提出的问题','questions',p)}${richNoteSection('需要调查的地方','investigations',p)}
    <div class="modal-actions"><button class="danger-btn" onclick="deleteProject('${p.id}')">删除项目</button><button class="primary-btn" onclick="saveProjectDrawer('${p.id}')">保存</button></div>`);
  wireImageDrop('projectDrop','projectRich');['handoffs','reports','questions','investigations'].forEach(k=>(p[k]||[]).forEach(n=>wireImageDrop(`${k}Drop_${n.id}`,`${k}Rich_${n.id}`)));
}

/* ---------- memo template hook ---------- */
function memoEditor(m){
  return `<div class="form-row"><input id="memoTitle" value="${esc(m.title)}"><input id="memoTags" placeholder="标签" value="${esc((m.tags||[]).join(', '))}"></div>
    <h3>内容</h3>${richEditor('memoRich',m.html,'Memo…')}
    <h3>Checkbox / 子任务</h3><div id="memoChecks">${(m.checks||[]).map(checkRow).join('')}</div><button class="small-btn" onclick="addCheckRow('memoChecks')">＋ Checkbox</button>
    <div id="memoDrop" class="drop-zone">Ctrl+V 粘贴截图，或拖图片到这里</div>${imageGrid(m.images,'memo',m.id)}
    <div class="modal-actions"><button class="ghost-btn" onclick="saveMemoAsTemplate('${m.id}')">☆ 保存为模板</button><button class="danger-btn" onclick="deleteMemo('${m.id}')">删除</button><button class="primary-btn" onclick="saveMemo('${m.id}')">保存</button></div>`;
}

/* ---------- template library ---------- */
function templateSection(title,type,items,renderItem){
  return `<div class="card template-section"><div class="section-title"><h2>${title}</h2><span class="muted">${items.length} 个</span></div>${items.map(renderItem).join('')||'<div class="empty">还没有模板</div>'}</div>`;
}
function renderTemplates(){
  $('#page-templates').innerHTML=`<div class="section-title"><h2>🧩 Template Library</h2><span class="muted">统一管理 Kanban / Routine / SOP / Project / Memo 模板</span></div>
  <div class="grid grid-2 template-grid">
    ${templateSection('📊 Kanban','kanban',state.kanbanTemplates,t=>`<div class="item"><div class="item-row"><div><b>${esc(t.name)}</b><div class="item-meta">${esc(t.title||'')}</div></div><div><button class="small-btn" onclick="applyKanbanTemplate('${t.id}')">使用</button> <button class="small-btn" onclick="editKanbanTemplate('${t.id}')">编辑</button> <button class="danger-btn" onclick="deleteTemplate('kanban','${t.id}')">删除</button></div></div></div>`)}
    ${templateSection('🔁 Routine','routine',state.routineTemplates,t=>`<div class="item"><div class="item-row"><b>${esc(t.name)}</b><div><button class="small-btn" onclick="useRoutineTemplate('${t.id}')">使用</button> <button class="small-btn" onclick="editRoutineTemplate('${t.id}')">编辑</button> <button class="danger-btn" onclick="deleteTemplate('routine','${t.id}')">删除</button></div></div></div>`)}
    ${templateSection('📚 SOP','sop',state.sopTemplates,t=>`<div class="item"><div class="item-row"><div><b>${esc(t.name)}</b><div class="item-meta">${esc(t.category||'')}</div></div><div><button class="small-btn" onclick="startSop('${t.id}')">使用</button> <button class="small-btn" onclick="openSopTemplate('${t.id}')">编辑</button> <button class="danger-btn" onclick="deleteTemplate('sop','${t.id}')">删除</button></div></div></div>`)}
    ${templateSection('🗂 Project','project',state.projectTemplates,t=>`<div class="item"><div class="item-row"><b>${esc(t.name)}</b><div><button class="small-btn" onclick="useProjectTemplate('${t.id}')">使用</button> <button class="small-btn" onclick="editProjectTemplate('${t.id}')">编辑</button> <button class="danger-btn" onclick="deleteTemplate('project','${t.id}')">删除</button></div></div></div>`)}
    ${templateSection('📝 Memo','memo',state.memoTemplates,t=>`<div class="item"><div class="item-row"><b>${esc(t.name)}</b><div><button class="small-btn" onclick="useMemoTemplate('${t.id}')">使用</button> <button class="small-btn" onclick="editMemoTemplate('${t.id}')">编辑</button> <button class="danger-btn" onclick="deleteTemplate('memo','${t.id}')">删除</button></div></div></div>`)}
  </div>`;
}
async function deleteTemplate(type,id){
  if(!confirm('删除这个模板？'))return;
  if(type==='kanban')state.kanbanTemplates=state.kanbanTemplates.filter(x=>x.id!==id);
  if(type==='routine')state.routineTemplates=state.routineTemplates.filter(x=>x.id!==id);
  if(type==='project')state.projectTemplates=state.projectTemplates.filter(x=>x.id!==id);
  if(type==='memo')state.memoTemplates=state.memoTemplates.filter(x=>x.id!==id);
  if(type==='sop')state.sopTemplates=state.sopTemplates.filter(x=>x.id!==id);
  await saveState();renderTemplates();
}

/* Kanban template editor */
function editKanbanTemplate(id){
  const t=state.kanbanTemplates.find(x=>x.id===id);if(!t)return;
  modal(`<h2>编辑 Kanban 模板</h2><div class="form-row"><input id="ktName" value="${esc(t.name)}" placeholder="模板名称"><input id="ktTitle" value="${esc(t.title||'')}" placeholder="卡片标题"></div><input id="ktTags" value="${esc((t.tags||[]).join(', '))}" placeholder="标签">${richEditor('ktRich',mergeTasksIntoHtml(t.html,t.checks||[]),'模板 Memo / 子任务…')}<div class="modal-actions"><button class="ghost-btn" onclick="closeModal()">取消</button><button class="primary-btn" onclick="saveKanbanTemplateEdit('${id}')">保存</button></div>`);
}
async function saveKanbanTemplateEdit(id){
  const t=state.kanbanTemplates.find(x=>x.id===id);if(!t)return;
  t.name=$('#ktName').value.trim();t.title=$('#ktTitle').value.trim();t.tags=splitTags($('#ktTags').value);t.html=$('#ktRich').innerHTML;t.checks=clearTaskTimes(collectInlineTasks('ktRich'));
  await saveState();closeModal();renderTemplates();
}

/* Routine template editor/use */
function editRoutineTemplate(id){
  const t=state.routineTemplates.find(x=>x.id===id),r=t?.snapshot;if(!r)return;
  modal(`<h2>编辑 Routine 模板</h2><input id="rtName" value="${esc(t.name)}" placeholder="模板名称"><div class="form-row"><input id="rtTitle" value="${esc(r.name)}" placeholder="Routine 名称"><input id="rtTags" value="${esc((r.tags||[]).join(', '))}" placeholder="标签"></div><div class="form-field"><label>重复</label><select id="rtRepeat"><option value="daily" ${r.repeat==='daily'?'selected':''}>每天</option><option value="weekdays" ${r.repeat==='weekdays'?'selected':''}>工作日</option><option value="custom" ${r.repeat==='custom'?'selected':''}>指定星期</option></select></div><div class="form-field"><label>子任务（每行一个）</label><textarea id="rtSubs">${esc((r.subtasks||[]).map(x=>x.title).join('\n'))}</textarea></div><div class="modal-actions"><button class="ghost-btn" onclick="closeModal()">取消</button><button class="primary-btn" onclick="saveRoutineTemplateEdit('${id}')">保存</button></div>`);
}
async function saveRoutineTemplateEdit(id){
  const t=state.routineTemplates.find(x=>x.id===id);if(!t)return;
  t.name=$('#rtName').value.trim();t.snapshot.name=$('#rtTitle').value.trim();t.snapshot.tags=splitTags($('#rtTags').value);t.snapshot.repeat=$('#rtRepeat').value;t.snapshot.subtasks=$('#rtSubs').value.split('\n').map(x=>x.trim()).filter(Boolean).map(title=>({id:uid(),title}));
  await saveState();closeModal();renderTemplates();
}
async function useRoutineTemplate(id){
  const t=state.routineTemplates.find(x=>x.id===id);if(!t)return;const r=structuredClone(t.snapshot);r.id=uid();r.subtasks=(r.subtasks||[]).map(s=>({...s,id:uid()}));state.routines.push(r);await saveState();goPage('routine');toast('已从模板创建 Routine');
}

/* Project template editor/use */
function editProjectTemplate(id){
  const t=state.projectTemplates.find(x=>x.id===id),p=t?.snapshot;if(!p)return;
  modal(`<h2>编辑 Project 模板</h2><input id="ptName" value="${esc(t.name)}" placeholder="模板名称"><div class="form-row"><input id="ptTitle" value="${esc(p.title)}" placeholder="项目标题"><input id="ptTags" value="${esc((p.tags||[]).join(', '))}" placeholder="标签"></div>${richEditor('ptRich',mergeTasksIntoHtml(p.html,p.subtasks||[]),'项目模板内容…')}<div class="modal-actions"><button class="ghost-btn" onclick="closeModal()">取消</button><button class="primary-btn" onclick="saveProjectTemplateEdit('${id}')">保存</button></div>`);
}
async function saveProjectTemplateEdit(id){
  const t=state.projectTemplates.find(x=>x.id===id);if(!t)return;
  t.name=$('#ptName').value.trim();t.snapshot.title=$('#ptTitle').value.trim();t.snapshot.tags=splitTags($('#ptTags').value);t.snapshot.html=$('#ptRich').innerHTML;t.snapshot.subtasks=clearTaskTimes(collectInlineTasks('ptRich'));
  await saveState();closeModal();renderTemplates();
}
async function useProjectTemplate(id){
  const t=state.projectTemplates.find(x=>x.id===id);if(!t)return;const s=structuredClone(t.snapshot);
  const p={...s,id:uid(),status:'todo',startedAt:null,completedAt:null,dueAt:'',createdAt:Date.now(),subtasks:clearTaskTimes(s.subtasks||[])};
  p.html=mergeTasksIntoHtml(p.html,p.subtasks);state.projects.unshift(p);await saveState();goPage('projects');setTimeout(()=>openProject(p.id),0);
}

/* Memo template editor/use */
function editMemoTemplate(id){
  const t=state.memoTemplates.find(x=>x.id===id),m=t?.snapshot;if(!m)return;
  modal(`<h2>编辑 Memo 模板</h2><input id="mtName" value="${esc(t.name)}" placeholder="模板名称"><div class="form-row"><input id="mtTitle" value="${esc(m.title)}" placeholder="Memo 标题"><input id="mtTags" value="${esc((m.tags||[]).join(', '))}" placeholder="标签"></div>${richEditor('mtRich',m.html||'','Memo 模板内容…')}<div class="modal-actions"><button class="ghost-btn" onclick="closeModal()">取消</button><button class="primary-btn" onclick="saveMemoTemplateEdit('${id}')">保存</button></div>`);
}
async function saveMemoTemplateEdit(id){
  const t=state.memoTemplates.find(x=>x.id===id);if(!t)return;
  t.name=$('#mtName').value.trim();t.snapshot.title=$('#mtTitle').value.trim();t.snapshot.tags=splitTags($('#mtTags').value);t.snapshot.html=$('#mtRich').innerHTML;
  await saveState();closeModal();renderTemplates();
}
async function useMemoTemplate(id){
  const t=state.memoTemplates.find(x=>x.id===id);if(!t)return;const s=structuredClone(t.snapshot);
  const m={...s,id:uid(),updatedAt:Date.now()};state.memos.unshift(m);activeMemoId=m.id;await saveState();goPage('memo');
}

/* ---------- refresh kanban template snapshots to preserve hierarchy ---------- */
async function saveKanbanTemplate(id){
  const t=state.kanban.find(x=>x.id===id);if(!t)return;const name=prompt('模板名称',t.title);if(!name)return;
  state.kanbanTemplates.push({
    id:uid(),name,title:t.title,html:t.html,tags:[...(t.tags||[])],
    checks:clearTaskTimes(t.checks||[]),plannedStartAt:'',dueAt:'',createdAt:Date.now()
  });
  await saveState();toast('已保存为模板');
}
async function applyKanbanTemplate(id){
  const x=state.kanbanTemplates.find(t=>t.id===id);if(!x)return;
  const checks=clearTaskTimes(x.checks||[]);
  const t={id:uid(),title:x.title,status:state.kanbanColumns[0]?.id||'todo',html:x.html,tags:[...(x.tags||[])],checks,images:[],startedAt:null,completedAt:null,plannedStartAt:'',dueAt:'',showMemo:false,archived:false,createdAt:Date.now()};
  t.html=mergeTasksIntoHtml(t.html,t.checks);state.kanban.push(t);await saveState();closeModal();goPage('kanban');setTimeout(()=>openKanbanCard(t.id),0);
}

/* ---------- Today card rendering uses current columns/colors, hides archived ---------- */
function renderToday(){
  ensureRecurringKanban();
  const d=todayISO(),rs=state.routines.filter(r=>isRoutineDue(r,d)),done=rs.filter(r=>getRLog(d,r.id)?.status==='done').length;
  const activeP=state.projects.filter(p=>p.status!=='done'&&!p.completedAt);
  const activeK=state.kanban.filter(x=>!x.completedAt&&!x.archived&&String(columnForCard(x)?.name||x.status).toUpperCase()!=='DONE');
  const recentProjects=[...state.projects].sort((a,b)=>(b.createdAt||b.startedAt||0)-(a.createdAt||a.startedAt||0)).slice(0,6);
  $('#page-today').innerHTML=`<div class="grid grid-3">
    <button class="card kpi-link" onclick="goPage('routine')"><div class="kpi">${done}/${rs.length}</div><div class="kpi-label">今日 Routine →</div></button>
    <button class="card kpi-link" onclick="goPage('projects')"><div class="kpi">${activeP.length}</div><div class="kpi-label">长期任务 / Projects →</div></button>
    <button class="card kpi-link" onclick="goPage('kanban')"><div class="kpi">${activeK.length}</div><div class="kpi-label">Kanban 未完成 →</div></button>
  </div>
  <div class="grid grid-2" style="margin-top:18px"><div class="card"><div class="section-title"><h2>今日 Routine</h2><button class="small-btn" onclick="goPage('routine')">历史</button></div>${rs.map(r=>routineItem(r,d)).join('')}</div>
  <div class="card"><div class="section-title"><h2>长期任务</h2><button class="small-btn" onclick="goPage('projects')">全部</button></div>${recentProjects.map(projectSummary).join('')||'<div class="empty">还没有长期任务</div>'}</div></div>
  <div class="card" style="margin-top:18px"><div class="section-title"><h2>📊 Kanban</h2><button class="small-btn" onclick="goPage('kanban')">打开看板</button></div><div class="today-kanban-grid"><div>${activeK.slice(0,4).map(t=>cardHtml(t,columnForCard(t))).join('')||'<div class="empty">没有未完成卡片</div>'}</div><div>${calendarModule(todayCalMonth,kanbanCalendarItems(),'todayCalendarShift',true)}</div></div></div>
  <div style="margin-top:18px">${tagSearchModule()}</div>`;
}
/* ======================= END V6 OVERRIDES ======================= */


/* ======================= V7 OVERRIDES ======================= */
const V7_DEFAULT_CARD_COLOR='#ffffff';

function migrateV7(){
  (state.kanban||[]).forEach(t=>{t.cardColor??='';});
  (state.memos||[]).forEach(m=>{m.checks??=[];m.images??=[];m.tags??=[];m.html??='';});
  (state.routines||[]).forEach(r=>{r.tags??=[];r.subtasks??=[];});
}
async function loadState(){
  await openDB();
  state=await dbGet('state');
  if(!state)state=structuredClone(DEFAULT);
  migrate();migrateV5();migrateV6();migrateV7();
  ensureRecurringKanban();
  await saveState();
}

/* ---------- inline nested task with delete ---------- */
function inlineTaskMarkup(t={}){
  const id=t.id||uid(), title=esc(t.text||t.title||'新子任务'), due=esc(t.dueAt||''), st=t.startedAt||'', done=t.completedAt||'', checked=t.done||t.completedAt,children=t.children||[];
  return `<div class="inline-task-wrap" data-wrapper-id="${id}">
    <span class="inline-task" data-task-id="${id}" data-started="${st||''}" data-completed="${done||''}" data-due="${due}" contenteditable="false">
      <button type="button" class="inline-start" title="Start" onclick="inlineTaskStart(this)">▶</button>
      <input type="checkbox" ${checked?'checked':''} onchange="inlineTaskDone(this)">
      <span class="inline-task-text" contenteditable="true">${title}</span>
      <button type="button" class="inline-due" title="预计完成时间" onclick="inlineTaskDue(this)">⏰</button>
      <button type="button" class="inline-child" title="添加下级子任务" onclick="inlineTaskChild(this)">＋↳</button>
      <button type="button" class="inline-delete" title="删除子任务" onclick="removeInlineTask(this)">🗑</button>
      <span class="inline-task-meta">${st?fmtTime(Number(st)):'未开始'}${due?' · 预计 '+due.replace('T',' '):''}${done?' · 完成 '+fmtTime(Number(done)):''}</span>
    </span>
    <div class="inline-children">${children.map(inlineTaskMarkup).join('')}</div>
  </div>`;
}
function removeInlineTask(btn){
  const wrap=btn.closest('.inline-task-wrap');
  if(!wrap)return;
  if(confirm('删除这个子任务以及它的下级子任务？'))wrap.remove();
}

/* ---------- card individual color ---------- */
function cardColorFor(t,c){
  if(t.completedAt || String(c?.name||'').toUpperCase()==='DONE')return '#eeeeef';
  return t.cardColor || c?.cardColor || V7_DEFAULT_CARD_COLOR;
}
function openKanbanCard(id){
  const t=state.kanban.find(x=>x.id===id)||{
    id:'',title:'',status:state.kanbanColumns[0]?.id||'todo',html:'',checks:[],tags:[],
    startedAt:null,completedAt:null,plannedStartAt:'',dueAt:'',showMemo:false,archived:false,cardColor:''
  };
  const merged=mergeTasksIntoHtml(t.html,t.checks||[]);
  drawer(`<div class="drawer-head"><div><h2 style="margin:0">${id?esc(t.title):'新建 Kanban 卡片'}</h2><div class="item-meta">实际开始 ${fmtTime(t.startedAt)} · 实际完成 ${fmtTime(t.completedAt)}</div></div><button class="ghost-btn" onclick="closeDrawer()">✕</button></div>
    <div class="detail-grid"><div class="form-field"><label>标题</label><input id="kcTitle" value="${esc(t.title)}"></div><div class="form-field"><label>状态</label><select id="kcStatus">${state.kanbanColumns.map(c=>`<option value="${c.id}" ${t.status===c.id?'selected':''}>${esc(c.name)}</option>`).join('')}</select></div></div>
    <div class="detail-grid compact-fields"><div class="form-field"><label>预计开始</label><input type="datetime-local" id="kcPlanned" value="${esc(t.plannedStartAt||'')}"></div><div class="form-field"><label>预计完成</label><input type="datetime-local" id="kcDue" value="${esc(t.dueAt||'')}"></div></div>
    <div class="detail-grid compact-fields"><div class="form-field"><label>标签</label><input id="kcTags" value="${esc((t.tags||[]).join(', '))}"></div><div class="form-field"><label>这张卡片的颜色</label><div class="color-row"><input type="color" id="kcColor" value="${esc(t.cardColor||columnForCard(t)?.cardColor||'#ffffff')}"><button class="small-btn" onclick="$('#kcColor').value='${esc(columnForCard(t)?.cardColor||'#ffffff')}'">恢复列默认</button></div></div></div>
    <h3>Memo / 作业说明</h3><div class="item-meta">☑ 子任务支持继续分层；每一个任务右侧 🗑 可以删除。</div>
    ${richEditor('kanbanRich',merged,'文字、任务、图片、链接可混排…')}
    <div id="kanbanDrop" class="drop-zone">Ctrl+V 或拖图片到编辑框</div>
    <div class="modal-actions">${id?`<button class="icon-btn footer-icon" title="保存为模板" onclick="saveKanbanTemplate('${t.id}')">☆</button><button class="icon-btn footer-icon" title="定期重复" onclick="openRepeatModal('${t.id}')">🔁</button><button class="danger-btn" onclick="deleteKanban('${t.id}')">删除卡片</button>`:''}<button class="primary-btn" onclick="saveKanbanDrawer('${t.id}')">保存</button></div>`);
  wireImageDrop('kanbanDrop','kanbanRich');
}
async function saveKanbanDrawer(id){
  let t=id?state.kanban.find(x=>x.id===id):{id:uid(),images:[],startedAt:null,completedAt:null,showMemo:false,archived:false};
  const tasks=collectInlineTasks('kanbanRich');
  Object.assign(t,{
    title:$('#kcTitle').value.trim(),status:$('#kcStatus').value,tags:splitTags($('#kcTags').value),
    html:$('#kanbanRich').innerHTML,checks:tasks,plannedStartAt:$('#kcPlanned').value,dueAt:$('#kcDue').value,
    cardColor:$('#kcColor').value
  });
  if(tasksAllDone(tasks)&&!t.completedAt){
    if(!t.startedAt)t.startedAt=Date.now();t.completedAt=Date.now();
    t.status=state.kanbanColumns.find(c=>String(c.name).toUpperCase()==='DONE')?.id||'done';
  }
  if(!id)state.kanban.push(t);
  await saveState();closeDrawer();renderKanban();
}

/* ---------- delete kanban column ---------- */
function renameKanbanColumn(id){
  const c=state.kanbanColumns.find(x=>x.id===id);if(!c)return;
  modal(`<h2>列设置</h2>
    <div class="form-field"><label>列名称</label><input id="colName" value="${esc(c.name)}"></div>
    <div class="form-row"><div class="form-field"><label>列背景</label><input id="colBg" type="color" value="${esc(c.bgColor||'#eef1f6')}"></div><div class="form-field"><label>默认卡片背景</label><input id="colCard" type="color" value="${esc(c.cardColor||'#ffffff')}"></div></div>
    <div class="modal-actions"><button class="danger-btn" onclick="prepareDeleteColumn('${id}')">删除这一列</button><span style="flex:1"></span><button class="ghost-btn" onclick="closeModal()">取消</button><button class="primary-btn" onclick="saveColumnSettings('${id}')">保存</button></div>`);
}
function prepareDeleteColumn(id){
  if(state.kanbanColumns.length<=1)return toast('至少保留一列');
  const c=state.kanbanColumns.find(x=>x.id===id),cards=state.kanban.filter(x=>x.status===id&&!x.archived),others=state.kanbanColumns.filter(x=>x.id!==id);
  if(!cards.length){deleteColumnNow(id,null);return}
  modal(`<h2>删除「${esc(c.name)}」</h2><p>这一列里还有 ${cards.length} 张卡片。请选择移动到哪一列：</p><select id="moveColumnTarget">${others.map(x=>`<option value="${x.id}">${esc(x.name)}</option>`).join('')}</select><div class="modal-actions"><button class="ghost-btn" onclick="closeModal()">取消</button><button class="danger-btn" onclick="deleteColumnNow('${id}',$('#moveColumnTarget').value)">移动卡片并删除列</button></div>`);
}
async function deleteColumnNow(id,targetId){
  if(targetId)state.kanban.filter(x=>x.status===id).forEach(x=>x.status=targetId);
  state.kanbanColumns=state.kanbanColumns.filter(x=>x.id!==id);
  state.kanbanRecurring.filter(r=>r.targetColumnId===id).forEach(r=>r.targetColumnId=targetId||state.kanbanColumns[0]?.id);
  await saveState();closeModal();renderKanban();toast('列已删除');
}

/* ---------- routine delete ---------- */
async function deleteRoutine(id){
  const r=state.routines.find(x=>x.id===id);if(!r)return;
  if(!confirm(`删除 Routine「${r.name}」？已有历史打卡记录不会自动显示，但备份中仍可恢复。`))return;
  state.routines=state.routines.filter(x=>x.id!==id);
  await saveState();renderRoutine();
}
function renderRoutine(){
  const due=state.routines.filter(r=>isRoutineDue(r,routineViewDate));
  $('#page-routine').innerHTML=`<div class="card"><div class="section-title"><h2>Daily Routine</h2><div><button class="ghost-btn" onclick="goPage('templates')">🧩 模板库</button> <button class="primary-btn" onclick="openRoutineModal()">＋ 新建 Routine</button></div></div>
    <div class="form-row"><div class="form-field"><label>查看日期</label><input type="date" value="${routineViewDate}" onchange="routineViewDate=this.value;renderRoutine()"></div><div class="item">${fmtDate(routineViewDate)}</div></div>
    <div class="list" style="margin-top:14px">${due.map(r=>routineItem(r,routineViewDate)).join('')}</div></div>
    <div class="card" style="margin-top:18px"><h2>Routine 管理</h2>${state.routines.map(r=>`<div class="item"><div class="item-row"><div><b>${esc(r.name)}</b><div class="tags">${tagHtml(r.tags)}</div><div class="item-meta">${repeatText(r)} · ${(r.subtasks||[]).length} 个子任务</div></div><div><button class="small-btn" onclick="saveRoutineAsTemplate('${r.id}')">☆ 模板</button> <button class="small-btn" onclick="openRoutineModal('${r.id}')">编辑</button> <button class="danger-btn" onclick="deleteRoutine('${r.id}')">删除</button></div></div></div>`).join('')}</div>`;
}

/* ---------- project explicit delete is kept; category delete ---------- */
function openCategoryModal(id){
  const c=state.projectCategories.find(x=>x.id===id)||{name:''};
  modal(`<h2>${id?'编辑':'新建'}分类</h2><input id="catName" value="${esc(c.name)}"><div class="modal-actions">${id?`<button class="danger-btn" onclick="deleteProjectCategory('${id}')">删除分类</button>`:''}<span style="flex:1"></span><button class="ghost-btn" onclick="closeModal()">取消</button><button class="primary-btn" onclick="saveCategory('${id||''}')">保存</button></div>`);
}
async function deleteProjectCategory(id){
  const c=state.projectCategories.find(x=>x.id===id);if(!c)return;
  if(!confirm(`删除分类「${c.name}」？里面的项目会移动到“未分类”。`))return;
  state.projects.filter(p=>p.categoryId===id).forEach(p=>p.categoryId='');
  state.projectCategories=state.projectCategories.filter(x=>x.id!==id);
  await saveState();closeModal();renderProjects();
}

/* ---------- SOP delete ---------- */
async function deleteSopTemplate(id){
  const t=state.sopTemplates.find(x=>x.id===id);if(!t)return;
  if(!confirm(`删除 SOP 模板「${t.name}」？已有执行历史不会删除。`))return;
  state.sopTemplates=state.sopTemplates.filter(x=>x.id!==id);
  await saveState();renderSOP();
}
function renderSOP(){
  $('#page-sop').innerHTML=`<div class="section-title"><h2>SOP Templates</h2><div><button class="ghost-btn" onclick="goPage('templates')">🧩 模板库</button> <button class="primary-btn" onclick="openSopTemplate()">＋ 新建 SOP</button></div></div><div class="grid grid-2">${state.sopTemplates.map(t=>`<div class="card"><span class="pill">${esc(t.category||'General')}</span><h2>${esc(t.name)}</h2><div class="muted">${esc(t.description||'')}</div><div style="margin:12px 0">${t.steps.map((s,i)=>`<div class="item-meta">${i+1}. ${esc(s.title)}</div>`).join('')}</div><button class="primary-btn" onclick="startSop('${t.id}')">▶ 开始作业</button> <button class="ghost-btn" onclick="openSopTemplate('${t.id}')">编辑</button> <button class="danger-btn" onclick="deleteSopTemplate('${t.id}')">删除</button></div>`).join('')}</div>`;
}

/* ---------- MEMO FIX: self-contained renderer ---------- */
function memoCheckRow(c){
  return `<div class="item check-row" data-id="${c.id||uid()}"><div class="memo-check-row"><input type="checkbox" class="c-done" ${c.done?'checked':''}><input class="c-text" value="${esc(c.text||'')}" placeholder="子任务"><input type="datetime-local" class="c-due" value="${esc(c.dueAt||'')}"><button class="danger-btn micro-delete" onclick="this.closest('.check-row').remove()">删除</button></div></div>`;
}
function collectMemoChecks(old=[]){
  return $$('#memoChecks .check-row').map(e=>{
    const prev=old.find(x=>x.id===e.dataset.id)||{};
    const done=e.querySelector('.c-done').checked;
    return {id:e.dataset.id,text:e.querySelector('.c-text').value.trim(),dueAt:e.querySelector('.c-due').value,done,startedAt:prev.startedAt||null,completedAt:done?(prev.completedAt||Date.now()):null};
  }).filter(x=>x.text);
}
function renderMemo(){
  if(!activeMemoId&&state.memos[0])activeMemoId=state.memos[0].id;
  const list=state.memos.filter(x=>!memoFilter||x.title.toLowerCase().includes(memoFilter.toLowerCase())||(x.tags||[]).some(t=>t.toLowerCase().includes(memoFilter.toLowerCase())));
  const m=state.memos.find(x=>x.id===activeMemoId);
  $('#page-memo').innerHTML=`<div class="grid memo-layout">
    <div class="card memo-list-panel"><div class="section-title"><h2>Memos</h2><button class="small-btn" onclick="newMemo()">＋</button></div>
      <input id="memoFilterInput" placeholder="标题 / 标签筛选" value="${esc(memoFilter)}" oninput="memoFilter=this.value;filterMemoList(this.value)">
      <div id="memoListItems" class="list" style="margin-top:12px">${list.map(x=>`<button class="item memo-list-item ${x.id===activeMemoId?'selected':''}" data-search="${esc((x.title+' '+(x.tags||[]).join(' ')).toLowerCase())}" onclick="activeMemoId='${x.id}';renderMemo()"><div class="item-title">${esc(x.title)}</div><div class="tags">${tagHtml(x.tags)}</div><div class="item-meta">${new Date(x.updatedAt||Date.now()).toLocaleString()}</div></button>`).join('')||'<div class="empty">还没有 Memo</div>'}</div>
    </div>
    <div class="card memo-editor-panel">${m?memoEditorV7(m):'<div class="empty">点击左边 Memo，或新建一个 Memo</div>'}</div>
  </div>`;
  if(m)wireImageDrop('memoDrop','memoRich',async im=>{m.images??=[];m.images.push(im);m.updatedAt=Date.now();await saveState();renderMemo()});
}
function filterMemoList(v){
  const q=(v||'').toLowerCase();
  document.querySelectorAll('#memoListItems .memo-list-item').forEach(el=>el.style.display=!q||(el.dataset.search||'').includes(q)?'':'none');
}
function memoEditorV7(m){
  return `<div class="form-row"><input id="memoTitle" value="${esc(m.title)}"><input id="memoTags" placeholder="标签" value="${esc((m.tags||[]).join(', '))}"></div>
    <h3>内容</h3>${richEditor('memoRich',m.html||'','Memo…')}
    <h3>Checkbox / 子任务</h3><div id="memoChecks">${(m.checks||[]).map(memoCheckRow).join('')}</div><button class="small-btn" onclick="$('#memoChecks').insertAdjacentHTML('beforeend',memoCheckRow({id:uid(),text:'',done:false,dueAt:''}))">＋ Checkbox</button>
    <div id="memoDrop" class="drop-zone">Ctrl+V 粘贴截图，或拖图片到这里</div>${imageGrid(m.images||[],'memo',m.id)}
    <div class="modal-actions"><button class="ghost-btn" onclick="saveMemoAsTemplate('${m.id}')">☆ 保存为模板</button><button class="danger-btn" onclick="deleteMemo('${m.id}')">删除 Memo</button><button class="primary-btn" onclick="saveMemoV7('${m.id}')">保存</button></div>`;
}
async function saveMemoV7(id){
  const m=state.memos.find(x=>x.id===id);if(!m)return;
  Object.assign(m,{title:$('#memoTitle').value.trim()||'Untitled Memo',tags:splitTags($('#memoTags').value),html:$('#memoRich').innerHTML,checks:collectMemoChecks(m.checks||[]),updatedAt:Date.now()});
  await saveState();toast('Memo 已保存');renderMemo();
}
async function deleteMemo(id){
  const m=state.memos.find(x=>x.id===id);if(!m)return;
  if(!confirm(`删除 Memo「${m.title}」？`))return;
  state.memos=state.memos.filter(x=>x.id!==id);
  activeMemoId=state.memos[0]?.id||null;
  await saveState();renderMemo();
}

/* ---------- Today grouped Kanban accordion ---------- */
let todayKanbanOpenCols={};
function toggleTodayKanbanColumn(id){
  todayKanbanOpenCols[id]=!todayKanbanOpenCols[id];
  renderToday();
}
function todayColumnGroup(c){
  const cards=state.kanban.filter(t=>t.status===c.id&&!t.archived&&!t.completedAt);
  const open=todayKanbanOpenCols[c.id]??false;
  return `<div class="today-col-group">
    <button class="today-col-header" onclick="toggleTodayKanbanColumn('${c.id}')">
      <span><b>${esc(c.name)}</b> <span class="pill">${cards.length}</span></span><span>${open?'▾':'▸'}</span>
    </button>
    ${open?`<div class="today-col-cards">${cards.map(t=>cardHtml(t,c)).join('')||'<div class="empty small-empty">这一列没有未完成卡片</div>'}</div>`:''}
  </div>`;
}
function renderToday(){
  ensureRecurringKanban();
  const d=todayISO(),rs=state.routines.filter(r=>isRoutineDue(r,d)),done=rs.filter(r=>getRLog(d,r.id)?.status==='done').length;
  const activeP=state.projects.filter(p=>p.status!=='done'&&!p.completedAt);
  const activeK=state.kanban.filter(x=>!x.completedAt&&!x.archived&&String(columnForCard(x)?.name||x.status).toUpperCase()!=='DONE');
  const recentProjects=[...state.projects].sort((a,b)=>(b.createdAt||b.startedAt||0)-(a.createdAt||a.startedAt||0)).slice(0,6);
  $('#page-today').innerHTML=`<div class="grid grid-3">
    <button class="card kpi-link" onclick="goPage('routine')"><div class="kpi">${done}/${rs.length}</div><div class="kpi-label">今日 Routine →</div></button>
    <button class="card kpi-link" onclick="goPage('projects')"><div class="kpi">${activeP.length}</div><div class="kpi-label">长期任务 / Projects →</div></button>
    <button class="card kpi-link" onclick="goPage('kanban')"><div class="kpi">${activeK.length}</div><div class="kpi-label">Kanban 未完成 →</div></button>
  </div>
  <div class="grid grid-2" style="margin-top:18px"><div class="card"><div class="section-title"><h2>今日 Routine</h2><button class="small-btn" onclick="goPage('routine')">历史</button></div>${rs.map(r=>routineItem(r,d)).join('')}</div>
  <div class="card"><div class="section-title"><h2>长期任务</h2><button class="small-btn" onclick="goPage('projects')">全部</button></div>${recentProjects.map(projectSummary).join('')||'<div class="empty">还没有长期任务</div>'}</div></div>
  <div class="card" style="margin-top:18px"><div class="section-title"><h2>📊 Kanban</h2><button class="small-btn" onclick="goPage('kanban')">打开看板</button></div>
    <div class="today-kanban-grid"><div class="today-column-groups">${state.kanbanColumns.map(todayColumnGroup).join('')}</div><div>${calendarModule(todayCalMonth,kanbanCalendarItems(),'todayCalendarShift',true)}</div></div>
  </div><div style="margin-top:18px">${tagSearchModule()}</div>`;
}
/* ======================= END V7 OVERRIDES ======================= */
