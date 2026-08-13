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
 /* V10.8: legacy ed.onpaste removed; unified document paste handler owns image paste. */ ed.onpaste=null;
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


/* ==================== V8 RICH EDITOR FIXES ==================== */

/* All rich editors share the same compact icon-only toolbar. */
function richToolbar(id){
  return `<div class="rich-toolbar rich-toolbar-v8">
    <button type="button" class="rt-btn" title="粗体" onclick="richCmd('${id}','bold')"><b>B</b></button>
    <button type="button" class="rt-btn" title="下划线" onclick="richCmd('${id}','underline')"><u>U</u></button>
    <button type="button" class="rt-btn rt-red-a" title="字体颜色" onclick="openRichColorPicker('${id}')">A</button>
    <button type="button" class="rt-btn" title="高亮" onclick="richHighlight('${id}')">🖍</button>
    <button type="button" class="rt-btn" title="项目符号" onclick="richCmd('${id}','insertUnorderedList')">•</button>
    <button type="button" class="rt-btn" title="增加缩进" onclick="richCmd('${id}','indent')">→</button>
    <button type="button" class="rt-btn" title="减少缩进" onclick="richCmd('${id}','outdent')">←</button>
    <button type="button" class="rt-btn" title="链接" onclick="richLink('${id}')">🔗</button>
    <button type="button" class="rt-btn" title="插入子任务" onclick="insertInlineCheckbox('${id}')">☑</button>
    <button type="button" class="rt-btn" title="插入图片" onclick="pickInlineImage('${id}')">🖼</button>
  </div>`;
}

function openRichColorPicker(id){
  let picker=document.getElementById('__richColorPickerV8');
  if(!picker){
    picker=document.createElement('input');
    picker.id='__richColorPickerV8';
    picker.type='color';
    picker.value='#d32f2f';
    picker.style.position='fixed';
    picker.style.left='-100px';
    picker.style.top='-100px';
    document.body.appendChild(picker);
  }
  picker.oninput=()=>richColor(id,picker.value);
  picker.click();
}

function richEditor(id,html,placeholder='输入内容…'){
  return `${richToolbar(id)}<div id="${id}" class="rich-editor rich-editor-v8" contenteditable="true" data-placeholder="${esc(placeholder)}">${html||''}</div>`;
}

/* New task markup: every level always has start / due / child / delete controls. */
function inlineTaskMarkup(t={}){
  const id=t.id||uid();
  const title=esc(t.text||t.title||'新子任务');
  const due=esc(t.dueAt||'');
  const st=t.startedAt||'';
  const done=t.completedAt||'';
  const checked=t.done||t.completedAt;
  const children=t.children||[];
  return `<div class="inline-task-wrap" data-wrapper-id="${id}">
    <span class="inline-task" data-task-id="${id}" data-started="${st||''}" data-completed="${done||''}" data-due="${due}" contenteditable="false">
      <button type="button" class="inline-start task-icon" title="Start" onclick="inlineTaskStart(this)">▶</button>
      <input type="checkbox" ${checked?'checked':''} onchange="inlineTaskDone(this)">
      <span class="inline-task-text" contenteditable="true">${title}</span>
      <button type="button" class="inline-due task-icon" title="预计完成时间" onclick="inlineTaskDue(this)">⏰</button>
      <button type="button" class="inline-child task-icon" title="添加下级子任务" onclick="inlineTaskChild(this)">↳＋</button>
      <button type="button" class="inline-delete task-icon danger-icon" title="删除这个子任务" onclick="removeInlineTask(this)">✕</button>
      <span class="inline-task-meta">${st?fmtTime(Number(st)):'未开始'}${due?' · 预计 '+due.replace('T',' '):''}${done?' · 完成 '+fmtTime(Number(done)):''}</span>
    </span>
    <div class="inline-children">${children.map(inlineTaskMarkup).join('')}</div>
  </div>`;
}

/* Works even when there is no valid selection inside the editor (the old template bug). */
function insertInlineCheckbox(id){
  const ed=document.getElementById(id);
  if(!ed){ toast('当前编辑框还没有准备好'); return; }

  const html=inlineTaskMarkup({id:uid(),text:'新子任务',children:[]});
  ed.focus();

  const sel=window.getSelection();
  if(sel && sel.rangeCount && ed.contains(sel.anchorNode)){
    const range=sel.getRangeAt(0);
    range.deleteContents();
    const holder=document.createElement('div');
    holder.innerHTML=html;
    const node=holder.firstElementChild;
    range.insertNode(node);
    range.setStartAfter(node);
    range.collapse(true);
    sel.removeAllRanges();
    sel.addRange(range);
  }else{
    ed.insertAdjacentHTML('beforeend',html);
  }
  upgradeRichEditorTasks(ed);
}

/* Add a child task robustly. */
function inlineTaskChild(btn){
  const wrap=btn.closest('.inline-task-wrap');
  if(!wrap)return;
  let children=null;
  for(const child of wrap.children){
    if(child.classList && child.classList.contains('inline-children')){children=child;break;}
  }
  if(!children){
    children=document.createElement('div');
    children.className='inline-children';
    wrap.appendChild(children);
  }
  const holder=document.createElement('div');
  holder.innerHTML=inlineTaskMarkup({id:uid(),text:'新子任务',children:[]});
  children.appendChild(holder.firstElementChild);
}

/* Delete works at any depth. */
function removeInlineTask(btn){
  const wrap=btn.closest('.inline-task-wrap');
  if(!wrap)return;
  if(confirm('删除这个子任务？如果它还有下级子任务，下级也会一起删除。')){
    wrap.remove();
  }
}

/* Upgrade V5/V6/V7 task nodes already stored in IndexedDB.
   This is why old nested tasks also get a delete button. */
function upgradeRichEditorTasks(root){
  if(!root)return;
  root.querySelectorAll('.inline-task').forEach(task=>{
    task.setAttribute('contenteditable','false');

    if(!task.querySelector('.inline-child')){
      const child=document.createElement('button');
      child.type='button';
      child.className='inline-child task-icon';
      child.title='添加下级子任务';
      child.textContent='↳＋';
      child.onclick=function(){inlineTaskChild(this)};
      const meta=task.querySelector('.inline-task-meta');
      task.insertBefore(child,meta||null);
    }

    if(!task.querySelector('.inline-delete')){
      const del=document.createElement('button');
      del.type='button';
      del.className='inline-delete task-icon danger-icon';
      del.title='删除这个子任务';
      del.textContent='✕';
      del.onclick=function(){removeInlineTask(this)};
      const meta=task.querySelector('.inline-task-meta');
      task.insertBefore(del,meta||null);
    }
  });
}

/* Hydrate all editors after every modal/drawer/page render. */
function hydrateAllRichEditors(){
  document.querySelectorAll('.rich-editor').forEach(upgradeRichEditorTasks);
}
const __v8OldModal=modal;
modal=function(html){
  __v8OldModal(html);
  setTimeout(hydrateAllRichEditors,0);
};
const __v8OldDrawer=drawer;
drawer=function(html){
  __v8OldDrawer(html);
  setTimeout(hydrateAllRichEditors,0);
};
const __v8OldRenderAll=renderAll;
renderAll=function(){
  __v8OldRenderAll();
  setTimeout(hydrateAllRichEditors,0);
};

/* Memo page also needs hydration after its direct render. */
const __v8OldRenderMemo=renderMemo;
renderMemo=function(){
  __v8OldRenderMemo();
  setTimeout(hydrateAllRichEditors,0);
};

/* Template page is direct-rendered, too. */
const __v8OldRenderTemplates=renderTemplates;
renderTemplates=function(){
  __v8OldRenderTemplates();
  setTimeout(hydrateAllRichEditors,0);
};

/* Make template save functions collect the nested tasks from the editor. */
async function saveKanbanTemplateEdit(id){
  const t=state.kanbanTemplates.find(x=>x.id===id);if(!t)return;
  t.name=$('#ktName').value.trim();
  t.title=$('#ktTitle').value.trim();
  t.tags=splitTags($('#ktTags').value);
  t.html=$('#ktRich').innerHTML;
  t.checks=clearTaskTimes(collectInlineTasks('ktRich'));
  await saveState();closeModal();renderTemplates();
}
async function saveProjectTemplateEdit(id){
  const t=state.projectTemplates.find(x=>x.id===id);if(!t)return;
  t.name=$('#ptName').value.trim();
  t.snapshot.title=$('#ptTitle').value.trim();
  t.snapshot.tags=splitTags($('#ptTags').value);
  t.snapshot.html=$('#ptRich').innerHTML;
  t.snapshot.subtasks=clearTaskTimes(collectInlineTasks('ptRich'));
  await saveState();closeModal();renderTemplates();
}

/* ================== END V8 RICH EDITOR FIXES ================== */


/* ======================= V9 OVERRIDES ======================= */
let projectFilterV9='';
let sopMenuOpen = true;

function migrateV9(){
  state.navOrder ??= ['today','routine','projects','sopGroup','kanban','memo','templates','settings'];
  (state.projects||[]).forEach(p=>{p.plannedStartAt??='';});
  (state.routines||[]).forEach(r=>{r.subtasks??=[];});
}
async function loadState(){
  await openDB();
  state=await dbGet('state');
  if(!state)state=structuredClone(DEFAULT);
  migrate();migrateV5();migrateV6();migrateV7();migrateV9();
  ensureRecurringKanban();
  await saveState();
}

/* ---------- inline task ordering ---------- */
function inlineTaskMarkup(t={}){
  const id=t.id||uid(), title=esc(t.text||t.title||'新子任务'), due=esc(t.dueAt||''), st=t.startedAt||'', done=t.completedAt||'', checked=t.done||t.completedAt,children=t.children||[];
  return `<div class="inline-task-wrap" data-wrapper-id="${id}">
    <span class="inline-task" data-task-id="${id}" data-started="${st||''}" data-completed="${done||''}" data-due="${due}" contenteditable="false">
      <button type="button" class="inline-start task-icon" title="Start" onclick="inlineTaskStart(this)">▶</button>
      <input type="checkbox" ${checked?'checked':''} onchange="inlineTaskDone(this)">
      <span class="inline-task-text" contenteditable="true">${title}</span>
      <button type="button" class="task-icon" title="上移" onclick="moveInlineTask(this,-1)">↑</button>
      <button type="button" class="task-icon" title="下移" onclick="moveInlineTask(this,1)">↓</button>
      <button type="button" class="inline-due task-icon" title="预计完成时间" onclick="inlineTaskDue(this)">⏰</button>
      <button type="button" class="inline-child task-icon" title="添加下级子任务" onclick="inlineTaskChild(this)">↳＋</button>
      <button type="button" class="inline-delete task-icon danger-icon" title="删除这个子任务" onclick="removeInlineTask(this)">✕</button>
      <span class="inline-task-meta">${st?fmtTime(Number(st)):'未开始'}${due?' · 预计 '+due.replace('T',' '):''}${done?' · 完成 '+fmtTime(Number(done)):''}</span>
    </span>
    <div class="inline-children">${children.map(inlineTaskMarkup).join('')}</div>
  </div>`;
}
function moveInlineTask(btn,dir){
  const wrap=btn.closest('.inline-task-wrap');if(!wrap)return;
  const parent=wrap.parentElement;if(!parent)return;
  if(dir<0){
    let prev=wrap.previousElementSibling;
    while(prev && !prev.classList.contains('inline-task-wrap')) prev=prev.previousElementSibling;
    if(prev) parent.insertBefore(wrap,prev);
  }else{
    let next=wrap.nextElementSibling;
    while(next && !next.classList.contains('inline-task-wrap')) next=next.nextElementSibling;
    if(next) parent.insertBefore(next,wrap);
  }
}
function upgradeRichEditorTasks(root){
  if(!root)return;
  root.querySelectorAll('.inline-task').forEach(task=>{
    task.setAttribute('contenteditable','false');
    const ensure=(cls,text,title,handler,beforeMeta=true)=>{
      if(task.querySelector('.'+cls))return;
      const b=document.createElement('button');b.type='button';b.className=`${cls} task-icon`;b.title=title;b.textContent=text;b.onclick=handler;
      const meta=task.querySelector('.inline-task-meta');task.insertBefore(b,beforeMeta?(meta||null):null);
    };
    ensure('inline-up','↑','上移',function(){moveInlineTask(this,-1)});
    ensure('inline-down','↓','下移',function(){moveInlineTask(this,1)});
    if(!task.querySelector('.inline-child')){
      const b=document.createElement('button');b.type='button';b.className='inline-child task-icon';b.title='添加下级子任务';b.textContent='↳＋';b.onclick=function(){inlineTaskChild(this)};
      task.insertBefore(b,task.querySelector('.inline-task-meta')||null);
    }
    if(!task.querySelector('.inline-delete')){
      const b=document.createElement('button');b.type='button';b.className='inline-delete task-icon danger-icon';b.title='删除这个子任务';b.textContent='✕';b.onclick=function(){removeInlineTask(this)};
      task.insertBefore(b,task.querySelector('.inline-task-meta')||null);
    }
  });
}

/* ---------- Routine subtask ordering ---------- */
function moveRoutineSub(btn,dir){
  const row=btn.closest('.rsub'),parent=row?.parentElement;if(!row||!parent)return;
  if(dir<0 && row.previousElementSibling)parent.insertBefore(row,row.previousElementSibling);
  if(dir>0 && row.nextElementSibling)parent.insertBefore(row.nextElementSibling,row);
}
function routineSubEditRow(s){
  return `<div class="item rsub" data-id="${s.id||uid()}">
    <div class="rsub-order"><button class="icon-btn" title="上移" onclick="moveRoutineSub(this,-1)">↑</button><button class="icon-btn" title="下移" onclick="moveRoutineSub(this,1)">↓</button></div>
    <input class="rsub-title" value="${esc(s.title||'')}">
    <button class="danger-btn" onclick="this.closest('.rsub').remove()">删除</button>
  </div>`;
}
function openRoutineModal(id){
  const r=state.routines.find(x=>x.id===id)||{name:'',repeat:'weekdays',weekdays:[1,2,3,4,5],subtasks:[],tags:[]};
  modal(`<h2>${id?'编辑':'新建'} Routine</h2>
    <div class="form-row"><div class="form-field"><label>名称</label><input id="rName" value="${esc(r.name)}"></div><div class="form-field"><label>标签</label><input id="rTags" value="${esc((r.tags||[]).join(', '))}"></div></div>
    <div class="form-field"><label>重复</label><select id="rRepeat"><option value="daily" ${r.repeat==='daily'?'selected':''}>每天</option><option value="weekdays" ${r.repeat==='weekdays'?'selected':''}>工作日</option><option value="custom" ${r.repeat==='custom'?'selected':''}>指定星期</option></select></div>
    <div>${['日','一','二','三','四','五','六'].map((n,i)=>`<label class="checkbox-line"><input type="checkbox" class="rWeek" value="${i}" ${(r.weekdays||[]).includes(i)?'checked':''}>周${n}</label>`).join('')}</div>
    <h3>子任务</h3><div id="rSubs">${(r.subtasks||[]).map(routineSubEditRow).join('')}</div>
    <button class="small-btn" onclick="$('#rSubs').insertAdjacentHTML('beforeend',routineSubEditRow({id:uid(),title:''}))">＋子任务</button>
    <div class="modal-actions"><button class="ghost-btn" onclick="closeModal()">取消</button><button class="primary-btn" onclick="saveRoutineV9('${id||''}')">保存</button></div>`);
}
async function saveRoutineV9(id){
  const x={id:id||uid(),name:$('#rName').value.trim(),tags:splitTags($('#rTags').value),repeat:$('#rRepeat').value,weekdays:$$('.rWeek:checked').map(x=>+x.value),subtasks:$$('.rsub').map(e=>({id:e.dataset.id,title:e.querySelector('.rsub-title').value.trim()})).filter(x=>x.title)};
  if(id)state.routines[state.routines.findIndex(r=>r.id===id)]=x;else state.routines.push(x);
  await saveState();closeModal();renderAll();
}

/* ---------- Project planned start + filter fix ---------- */
function filterProjectsVisible(v){
  projectFilterV9=v||'';
  const q=projectFilterV9.trim().toLowerCase();
  document.querySelectorAll('#page-projects .project-filter-item').forEach(el=>{
    el.style.display=!q||(el.dataset.search||'').includes(q)?'':'none';
  });
  document.querySelectorAll('#page-projects .category-card').forEach(cat=>{
    const visible=[...cat.querySelectorAll('.project-filter-item')].some(el=>el.style.display!=='none');
    const empty=cat.querySelector('.empty');
    if(empty)empty.style.display=q&&visible?'none':'';
  });
}
function projectSummary(p){
  const tasks=p.subtasks||[],done=tasks.filter(x=>x.done||x.completedAt).length;
  const search=((p.title||'')+' '+(p.tags||[]).join(' ')).toLowerCase();
  return `<div class="item project-row project-filter-item" data-search="${esc(search)}">
    <div class="card-topline"><input class="main-check" type="checkbox" ${p.completedAt?'checked':''} onchange="event.stopPropagation();finishProject('${p.id}',this.checked)">
    <div class="card-body" onclick="openProject('${p.id}')"><div class="item-title">${esc(p.title)}</div>
    <div class="item-meta">${p.plannedStartAt?`计划 ${esc(p.plannedStartAt.replace('T',' '))} · `:''}Start ${fmtTime(p.startedAt)} · Done ${fmtTime(p.completedAt)} · ${done}/${tasks.length} 子任务</div>
    ${p.dueAt?`<div class="time-badge ${dueClass(p.dueAt)}">${dueText(p.dueAt)}</div>`:''}<div class="tags">${tagHtml(p.tags)}</div></div></div>
    <div class="card-actions">${!p.startedAt?`<button class="small-btn" onclick="event.stopPropagation();startProject('${p.id}')">▶ Start</button>`:''}</div>
    ${tasks.length?`<div class="sub-list">${tasks.map(s=>`<div class="sub-inline"><input type="checkbox" ${s.done||s.completedAt?'checked':''} onchange="toggleProjectSub('${p.id}','${s.id}',this.checked)"><span>${esc(s.text||s.title)}</span>${!s.startedAt?`<button class="small-btn" onclick="startProjectSub('${p.id}','${s.id}')">Start</button>`:`<span class="time-badge">${fmtTime(s.startedAt)}→${fmtTime(s.completedAt)}</span>`}${s.dueAt?`<span class="time-badge ${dueClass(s.dueAt)}">${dueText(s.dueAt)}</span>`:''}</div>`).join('')}</div>`:''}
  </div>`;
}
function renderProjects(){
  const cats=state.projectCategories;
  $('#page-projects').innerHTML=`<div class="section-title"><h2>长期任务 / Projects</h2><div><button class="ghost-btn" onclick="openCategoryModal()">＋ 分类</button> <button class="primary-btn" onclick="openProjectCreate()">＋ 新建项目</button></div></div>
    <div class="filterbar"><input id="projectFilterInputV9" placeholder="搜索标题 / 标签" value="${esc(projectFilterV9)}" oninput="filterProjectsVisible(this.value)"></div>
    ${cats.map(c=>{const ps=state.projects.filter(p=>p.categoryId===c.id);return `<div class="card category-card" style="margin-bottom:16px"><div class="section-title"><h2>${esc(c.name)}</h2><button class="small-btn" onclick="openCategoryModal('${c.id}')">编辑分类</button></div>${ps.map(projectSummary).join('')||'<div class="empty">这个分类还没有项目</div>'}</div>`}).join('')}
    <div class="card category-card"><div class="section-title"><h2>未分类</h2></div>${state.projects.filter(p=>!p.categoryId).map(projectSummary).join('')||'<div class="empty">无</div>'}</div>`;
  setTimeout(()=>filterProjectsVisible(projectFilterV9),0);
}
function openProject(id){
  const p=state.projects.find(x=>x.id===id);if(!p)return;
  drawer(`<div class="drawer-head"><div><h2 style="margin:0">${esc(p.title)}</h2><div class="item-meta">实际开始 ${fmtTime(p.startedAt)} · 实际完成 ${fmtTime(p.completedAt)}</div><div class="tags">${tagHtml(p.tags)}</div></div><button class="ghost-btn" onclick="closeDrawer()">✕</button></div>
    <div class="mini-actions" style="margin-top:10px">${!p.startedAt?`<button class="icon-btn" title="Start 主任务" onclick="startProject('${p.id}')">▶</button>`:''}<button class="icon-btn" title="完成主任务" onclick="finishProject('${p.id}',true)">✓</button><button class="icon-btn" title="保存为模板" onclick="saveProjectAsTemplate('${p.id}')">☆</button></div>
    <div class="detail-grid"><div class="form-field"><label>标题</label><input id="pdTitle" value="${esc(p.title)}"></div><div class="form-field"><label>分类</label><select id="pdCat"><option value="">未分类</option>${state.projectCategories.map(c=>`<option value="${c.id}" ${p.categoryId===c.id?'selected':''}>${esc(c.name)}</option>`).join('')}</select></div></div>
    <div class="detail-grid compact-fields"><div class="form-field"><label>预计开始</label><input type="datetime-local" id="pdPlanned" value="${esc(p.plannedStartAt||'')}"></div><div class="form-field"><label>预计完成</label><input type="datetime-local" id="pdDue" value="${esc(p.dueAt||'')}"></div></div>
    <div class="detail-grid compact-fields"><div class="form-field"><label>状态</label><select id="pdStatus"><option value="todo" ${p.status==='todo'?'selected':''}>TODO</option><option value="doing" ${p.status==='doing'?'selected':''}>DOING</option><option value="waiting" ${p.status==='waiting'?'selected':''}>WAITING</option><option value="done" ${p.status==='done'?'selected':''}>DONE</option></select></div><div class="form-field"><label>标签</label><input id="pdTags" value="${esc((p.tags||[]).join(', '))}"></div></div>
    <h3>项目 Memo / 任务层级</h3>${richEditor('projectRich',mergeTasksIntoHtml(p.html,p.subtasks||[]),'可在任意位置插任务，并用 ↑ ↓ 调整顺序…')}
    <div id="projectDrop" class="drop-zone">Ctrl+V 或拖图片</div>${richNoteSection('交接 / 对接人员','handoffs',p)}${richNoteSection('汇报记录','reports',p)}${richNoteSection('被提出的问题','questions',p)}${richNoteSection('需要调查的地方','investigations',p)}
    <div class="modal-actions"><button class="danger-btn" onclick="deleteProject('${p.id}')">删除项目</button><button class="primary-btn" onclick="saveProjectDrawerV9('${p.id}')">保存</button></div>`);
  wireImageDrop('projectDrop','projectRich');['handoffs','reports','questions','investigations'].forEach(k=>(p[k]||[]).forEach(n=>wireImageDrop(`${k}Drop_${n.id}`,`${k}Rich_${n.id}`)));
}
async function saveProjectDrawerV9(id){
  const p=state.projects.find(x=>x.id===id);
  const tasks=collectInlineTasks('projectRich').map(x=>({...x,title:x.text,note:''}));
  Object.assign(p,{title:$('#pdTitle').value.trim(),categoryId:$('#pdCat').value,plannedStartAt:$('#pdPlanned').value,dueAt:$('#pdDue').value,status:$('#pdStatus').value,tags:splitTags($('#pdTags').value),html:$('#projectRich').innerHTML,subtasks:tasks,handoffs:collectRichNotes('handoffs'),reports:collectRichNotes('reports'),questions:collectRichNotes('questions'),investigations:collectRichNotes('investigations')});
  if(p.subtasks.length&&p.subtasks.every(x=>x.done||x.completedAt)&&!p.completedAt){if(!p.startedAt)p.startedAt=Date.now();p.completedAt=Date.now();p.status='done'}
  await saveState();closeDrawer();renderProjects();toast('项目已保存');
}

/* ---------- Sidebar draggable order + SOP submenu ---------- */
function buildSidebarV9(){
  const nav=document.getElementById('nav');if(!nav)return;
  const existing={};
  nav.querySelectorAll('.nav-item').forEach(b=>existing[b.dataset.page]=b);
  const makeButton=(page,label)=>existing[page]||Object.assign(document.createElement('button'),{className:'nav-item',textContent:label});
  const labels={today:'🏠 Today',routine:'🔁 Routine',projects:'🗂 Projects',kanban:'📊 Kanban',memo:'📝 Memo',templates:'🧩 Templates',settings:'⚙ Settings'};
  nav.innerHTML='';
  const nodes={};
  Object.keys(labels).forEach(page=>{
    const b=makeButton(page,labels[page]);b.dataset.page=page;b.textContent=labels[page];b.onclick=()=>goPage(page);
    nodes[page]=b;
  });
  const sopWrap=document.createElement('div');sopWrap.className='nav-group';sopWrap.dataset.navkey='sopGroup';sopWrap.draggable=true;
  sopWrap.innerHTML=`<div class="nav-group-head"><button class="nav-arrow" title="展开/收起">▾</button><button class="nav-item nav-sop-main" data-page="sop">📚 SOP</button></div><div class="nav-sub ${sopMenuOpen?'open':''}"><button class="nav-item nav-sub-item" data-page="history">📜 Execution History</button></div>`;
  sopWrap.querySelector('.nav-arrow').onclick=e=>{e.stopPropagation();sopMenuOpen=!sopMenuOpen;sopWrap.querySelector('.nav-sub').classList.toggle('open',sopMenuOpen);sopWrap.querySelector('.nav-arrow').textContent=sopMenuOpen?'▾':'▸'};
  sopWrap.querySelector('[data-page=sop]').onclick=()=>goPage('sop');
  sopWrap.querySelector('[data-page=history]').onclick=()=>goPage('history');
  nodes.sopGroup=sopWrap;

  for(const key of state.navOrder||[]) if(nodes[key])nav.appendChild(nodes[key]);
  for(const [key,node] of Object.entries(nodes)) if(!nav.contains(node))nav.appendChild(node);

  [...nav.children].forEach(el=>{
    const key=el.dataset.navkey||el.dataset.page;if(!key)return;
    el.draggable=true;el.dataset.navkey=key;
    el.ondragstart=e=>{e.dataTransfer.setData('text/navkey',key);el.classList.add('dragging-nav')};
    el.ondragend=()=>el.classList.remove('dragging-nav');
    el.ondragover=e=>e.preventDefault();
    el.ondrop=async e=>{
      e.preventDefault();const from=e.dataTransfer.getData('text/navkey'),to=key;if(!from||from===to)return;
      let arr=[...(state.navOrder||[])].filter(x=>x!==from);const idx=arr.indexOf(to);arr.splice(idx<0?arr.length:idx,0,from);state.navOrder=arr;await saveState();buildSidebarV9();
    };
  });
}
const __v9DOMContentLoadedFlag=true;

/* keep active styling in nested menu */
function goPage(n){
  $$('.page').forEach(x=>x.classList.remove('active'));const page=$(`#page-${n}`);if(page)page.classList.add('active');
  $$('.nav-item').forEach(x=>x.classList.toggle('active',x.dataset.page===n));
  $('#pageTitle').textContent=({today:'Today',routine:'Routine',projects:'Projects',sop:'SOP',history:'Execution History',kanban:'Kanban',memo:'Memo',templates:'Templates',settings:'Settings'})[n]||n;
  renderPage(n);
}

/* ---------- Combined Today calendar: Routine + Kanban ---------- */
function routineCalendarStatus(dateStr){
  const due=state.routines.filter(r=>isRoutineDue(r,dateStr));
  if(!due.length)return null;
  const complete=due.every(r=>{
    const st=getRLog(dateStr,r.id)?.status;
    return st==='done'||st==='leave'||st==='na';
  });
  return {count:due.length,complete};
}
function todayCombinedCalendarItems(){
  return kanbanCalendarItems();
}
function combinedCalendar(monthKey,onShiftName){
  const [y,m]=monthKey.split('-').map(Number),first=new Date(y,m-1,1),last=new Date(y,m,0),start=first.getDay(),items=todayCombinedCalendarItems();
  let cells=['日','一','二','三','四','五','六'].map(x=>`<div class="cal-week">${x}</div>`);
  for(let i=0;i<start;i++)cells.push('<div class="cal-day blank"></div>');
  for(let day=1;day<=last.getDate();day++){
    const ds=`${y}-${String(m).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
    const rs=routineCalendarStatus(ds);
    let hits=items.filter(x=>x.date&&x.date.toISOString().slice(0,10)===ds).sort((a,b)=>Number(a.done)-Number(b.done));
    const events=hits.map(h=>`<button class="cal-event ${h.done?'done':''}" title="${esc(h.title)}" onclick="openKanbanCard('${h.id}')">${h.done?'✓ ':''}${esc(h.title)}</button>`).join('');
    const rIcon=rs?`<span class="routine-day-icon ${rs.complete?'complete':'pending'}" title="${rs.count} 个 Routine">${rs.complete?'●':'●'}</span>`:'';
    cells.push(`<div class="cal-day ${ds===todayISO()?'today':''}"><div class="cal-num-row"><span class="cal-num">${day}</span>${rIcon}</div><div class="cal-events-scroll">${events}</div></div>`);
  }
  return `<div class="calendar-card"><div class="cal-head"><button class="micro-btn" onclick="${onShiftName}(-1)">‹</button><b>${y}年${m}月</b><button class="micro-btn" onclick="${onShiftName}(1)">›</button></div><div class="calendar-v5">${cells.join('')}</div><div class="calendar-legend"><span><i class="legend-dot green"></i> Routine 未完成</span><span><i class="legend-dot gray"></i> Routine 已完成/休假/N/A</span></div></div>`;
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
  <div class="card" style="margin-top:18px"><div class="section-title"><h2>🗂 长期任务</h2><button class="small-btn" onclick="goPage('projects')">全部</button></div>${recentProjects.map(projectSummary).join('')||'<div class="empty">还没有长期任务</div>'}</div>
  <div class="card" style="margin-top:18px"><div class="section-title"><h2>📅 Routine + Kanban 日历</h2><span class="muted">Routine 状态用日期旁的小圆点表示；Kanban 任务显示在日期格内</span></div>${combinedCalendar(todayCalMonth,'todayCalendarShift')}</div>
  <div class="grid grid-2" style="margin-top:18px">
    <div class="card"><div class="section-title"><h2>今日 Routine</h2><button class="small-btn" onclick="goPage('routine')">历史</button></div>${rs.map(r=>routineItem(r,d)).join('')}</div>
    <div class="card"><div class="section-title"><h2>📊 Kanban</h2><button class="small-btn" onclick="goPage('kanban')">打开看板</button></div><div class="today-column-groups">${state.kanbanColumns.map(todayColumnGroup).join('')}</div></div>
  </div>
  <div style="margin-top:18px">${tagSearchModule()}</div>`;
}

/* ---------- init sidebar after app startup ---------- */
window.addEventListener('load',()=>setTimeout(buildSidebarV9,50));
/* ======================= END V9 OVERRIDES ======================= */


/* ======================= V10 OVERRIDES ======================= */
let tagSearchTextV10='';

function routineDefaultIcon(name=''){
  const n=name.toLowerCase();
  if(n.includes('mail'))return '✉';
  if(n.includes('jp1'))return '★';
  if(n.includes('idmc'))return '♥';
  return '●';
}
function migrateV10(){
  (state.routines||[]).forEach(r=>{
    r.icon??=routineDefaultIcon(r.name);
  });
  (state.routineTemplates||[]).forEach(t=>{
    if(t.snapshot)t.snapshot.icon??=routineDefaultIcon(t.snapshot.name||t.name);
  });
}
async function loadState(){
  await openDB();
  state=await dbGet('state');
  if(!state)state=structuredClone(DEFAULT);
  migrate();migrateV5();migrateV6();migrateV7();migrateV9();migrateV10();
  ensureRecurringKanban();
  await saveState();
}

/* ---------- robust rich-task event delegation ---------- */
/* contenteditable can swallow button clicks in some browsers. Capture them globally. */
document.addEventListener('click',e=>{
  const del=e.target.closest?.('.inline-delete');
  if(del){
    e.preventDefault();e.stopPropagation();
    const wrap=del.closest('.inline-task-wrap');
    if(wrap && confirm('删除这个子任务？如果它还有下级子任务，下级也会一起删除。'))wrap.remove();
    return;
  }
  const child=e.target.closest?.('.inline-child');
  if(child){
    e.preventDefault();e.stopPropagation();
    inlineTaskChild(child);return;
  }
  const up=e.target.closest?.('.inline-up');
  if(up){e.preventDefault();e.stopPropagation();moveInlineTask(up,-1);return;}
  const down=e.target.closest?.('.inline-down');
  if(down){e.preventDefault();e.stopPropagation();moveInlineTask(down,1);return;}
},true);

/* make old nodes get reliable button classes */
function upgradeRichEditorTasks(root){
  if(!root)return;
  root.querySelectorAll('.inline-task').forEach(task=>{
    task.setAttribute('contenteditable','false');
    const ensureBtn=(cls,text,title)=>{
      if(task.querySelector('.'+cls))return;
      const b=document.createElement('button');b.type='button';b.className=`${cls} task-icon`;b.title=title;b.textContent=text;
      task.insertBefore(b,task.querySelector('.inline-task-meta')||null);
    };
    ensureBtn('inline-up','↑','上移');
    ensureBtn('inline-down','↓','下移');
    ensureBtn('inline-child','↳＋','添加下级子任务');
    ensureBtn('inline-delete','✕','删除这个子任务');
  });
}

/* ---------- Routine icon + compact status buttons ---------- */
function routineStatusButtons(r,d){
  const st=getRLog(d,r.id)?.status||'';
  return `<div class="routine-icon-status">
    <button class="status-icon-btn ${st==='done'?'active done':''}" title="完成" onclick="setRoutineStatus('${d}','${r.id}','done')">✓</button>
    <button class="status-icon-btn ${st==='leave'?'active leave':''}" title="休假" onclick="setRoutineStatus('${d}','${r.id}','leave')">🏖</button>
    <button class="status-icon-btn ${st==='na'?'active na':''}" title="N/A" onclick="setRoutineStatus('${d}','${r.id}','na')">−</button>
    <button class="status-icon-btn ${st==='miss'?'active miss':''}" title="未完成" onclick="setRoutineStatus('${d}','${r.id}','miss')">✕</button>
  </div>`;
}
function routineItem(r,d){
  const log=getRLog(d,r.id);
  return `<div class="item routine-item-v10"><div class="item-row"><div class="routine-title-wrap"><span class="routine-icon-preview">${esc(r.icon||'●')}</span><div><div class="item-title">${esc(r.name)}</div><div class="item-meta">${log?.completedAt?'完成 '+fmtTime(log.completedAt):'主任务未完成'}</div></div></div>${routineStatusButtons(r,d)}</div>
    ${(r.subtasks||[]).map(s=>{const sl=log?.subtasks?.[s.id];return `<label class="checkbox-line subtask"><input type="checkbox" ${sl?.done?'checked':''} onchange="toggleRoutineSub('${d}','${r.id}','${s.id}',this.checked)"><span>${esc(s.title)}</span><span class="item-meta">${sl?.completedAt?fmtTime(sl.completedAt):''}</span></label>`}).join('')}
  </div>`;
}

/* ---------- Routine editor gets icon ---------- */
function openRoutineModal(id){
  const r=state.routines.find(x=>x.id===id)||{name:'',repeat:'weekdays',weekdays:[1,2,3,4,5],subtasks:[],tags:[],icon:'●'};
  modal(`<h2>${id?'编辑':'新建'} Routine</h2>
    <div class="form-row"><div class="form-field"><label>名称</label><input id="rName" value="${esc(r.name)}"></div><div class="form-field"><label>图标</label><input id="rIcon" value="${esc(r.icon||'●')}" maxlength="4" placeholder="例如 ✉ ★ ♥"></div></div>
    <div class="form-field"><label>标签</label><input id="rTags" value="${esc((r.tags||[]).join(', '))}"></div>
    <div class="form-field"><label>重复</label><select id="rRepeat"><option value="daily" ${r.repeat==='daily'?'selected':''}>每天</option><option value="weekdays" ${r.repeat==='weekdays'?'selected':''}>工作日</option><option value="custom" ${r.repeat==='custom'?'selected':''}>指定星期</option></select></div>
    <div>${['日','一','二','三','四','五','六'].map((n,i)=>`<label class="checkbox-line"><input type="checkbox" class="rWeek" value="${i}" ${(r.weekdays||[]).includes(i)?'checked':''}>周${n}</label>`).join('')}</div>
    <h3>子任务</h3><div id="rSubs">${(r.subtasks||[]).map(routineSubEditRow).join('')}</div>
    <button class="small-btn" onclick="$('#rSubs').insertAdjacentHTML('beforeend',routineSubEditRow({id:uid(),title:''}))">＋子任务</button>
    <div class="modal-actions"><button class="ghost-btn" onclick="closeModal()">取消</button><button class="primary-btn" onclick="saveRoutineV10('${id||''}')">保存</button></div>`);
}
async function saveRoutineV10(id){
  const x={id:id||uid(),name:$('#rName').value.trim(),icon:($('#rIcon').value.trim()||'●'),tags:splitTags($('#rTags').value),repeat:$('#rRepeat').value,weekdays:$$('.rWeek:checked').map(x=>+x.value),subtasks:$$('.rsub').map(e=>({id:e.dataset.id,title:e.querySelector('.rsub-title').value.trim()})).filter(x=>x.title)};
  if(id)state.routines[state.routines.findIndex(r=>r.id===id)]=x;else state.routines.push(x);
  await saveState();closeModal();renderAll();
}

/* preserve icon in routine templates */
function cloneRoutineSnapshot(r){
  return{name:r.name,icon:r.icon||'●',tags:[...(r.tags||[])],repeat:r.repeat,weekdays:[...(r.weekdays||[])],subtasks:(r.subtasks||[]).map(s=>({id:uid(),title:s.title}))}
}

/* ---------- Routine calendar with per-task icons ---------- */
function routineDayIcons(dateStr){
  return state.routines.filter(r=>isRoutineDue(r,dateStr)).map(r=>{
    const st=getRLog(dateStr,r.id)?.status;
    const complete=st==='done'||st==='leave'||st==='na';
    return {icon:r.icon||'●',complete,name:r.name,status:st||''};
  });
}
function routineCalendar(monthKey,onShiftName,showKanban=false){
  const [y,m]=monthKey.split('-').map(Number),first=new Date(y,m-1,1),last=new Date(y,m,0),start=first.getDay();
  const kitems=showKanban?kanbanCalendarItems():[];
  let cells=['日','一','二','三','四','五','六'].map(x=>`<div class="cal-week">${x}</div>`);
  for(let i=0;i<start;i++)cells.push('<div class="cal-day blank"></div>');
  for(let day=1;day<=last.getDate();day++){
    const ds=`${y}-${String(m).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
    const icons=routineDayIcons(ds);
    const iconHtml=icons.map(x=>`<span class="routine-task-icon ${x.complete?'complete':'pending'}" title="${esc(x.name)}">${esc(x.icon)}</span>`).join('');
    const hits=showKanban?kitems.filter(x=>x.date&&x.date.toISOString().slice(0,10)===ds).sort((a,b)=>Number(a.done)-Number(b.done)):[];
    const events=hits.map(h=>`<button class="cal-event ${h.done?'done':''}" title="${esc(h.title)}" onclick="openKanbanCard('${h.id}')">${h.done?'✓ ':''}${esc(h.title)}</button>`).join('');
    cells.push(`<div class="cal-day ${ds===todayISO()?'today':''}"><div class="cal-num-row"><span class="cal-num">${day}</span><span class="routine-icons-row">${iconHtml}</span></div><div class="cal-events-scroll">${events}</div></div>`);
  }
  return `<div class="calendar-card"><div class="cal-head"><button class="micro-btn" onclick="${onShiftName}(-1)">‹</button><b>${y}年${m}月</b><button class="micro-btn" onclick="${onShiftName}(1)">›</button></div><div class="calendar-v5">${cells.join('')}</div>
    <div class="calendar-legend"><span class="legend-routine-example pending">✉</span> 未完成 Routine <span class="legend-routine-example complete">✉</span> 已完成 / 休假 / N/A</div>
  </div>`;
}
function combinedCalendar(monthKey,onShiftName){return routineCalendar(monthKey,onShiftName,true)}

/* ---------- Routine page: calendar on right spanning both sections ---------- */
function renderRoutine(){
  const due=state.routines.filter(r=>isRoutineDue(r,routineViewDate));
  $('#page-routine').innerHTML=`<div class="routine-page-layout">
    <div class="routine-left-stack">
      <div class="card"><div class="section-title"><h2>Daily Routine</h2><div><button class="ghost-btn" onclick="goPage('templates')">🧩</button> <button class="primary-btn" onclick="openRoutineModal()">＋ 新建 Routine</button></div></div>
        <div class="form-field routine-date-field"><label>查看日期</label><input type="date" value="${routineViewDate}" onchange="routineViewDate=this.value;renderRoutine()"></div>
        <div class="list" style="margin-top:14px">${due.map(r=>routineItem(r,routineViewDate)).join('')||'<div class="empty">这一天没有 Routine</div>'}</div>
      </div>
      <div class="card"><div class="section-title"><h2>Routine 管理</h2></div>${state.routines.map(r=>`<div class="item"><div class="item-row"><div class="routine-title-wrap"><span class="routine-icon-preview">${esc(r.icon||'●')}</span><div><b>${esc(r.name)}</b><div class="tags">${tagHtml(r.tags)}</div><div class="item-meta">${repeatText(r)} · ${(r.subtasks||[]).length} 个子任务</div></div></div><div><button class="small-btn" onclick="saveRoutineAsTemplate('${r.id}')">☆</button> <button class="small-btn" onclick="openRoutineModal('${r.id}')">✎</button> <button class="danger-btn" onclick="deleteRoutine('${r.id}')">✕</button></div></div></div>`).join('')}</div>
    </div>
    <div class="card routine-calendar-side"><div class="section-title"><h2>📅 Routine 日历</h2></div>${routineCalendar(todayCalMonth,'todayCalendarShift',false)}</div>
  </div>`;
}

/* ---------- tag search without rerender ---------- */
function unifiedTagResults(q){
  q=(q||'').trim().toLowerCase();if(!q)return[];
  const out=[];
  state.routines.forEach(x=>{if((x.tags||[]).some(t=>t.toLowerCase().includes(q)))out.push({type:'Routine',title:x.name,page:'routine'})});
  state.projects.forEach(x=>{if((x.tags||[]).some(t=>t.toLowerCase().includes(q)))out.push({type:'Project',title:x.title,page:'projects',id:x.id})});
  state.kanban.filter(x=>!x.archived).forEach(x=>{if((x.tags||[]).some(t=>t.toLowerCase().includes(q)))out.push({type:'Kanban',title:x.title,page:'kanban',id:x.id})});
  state.memos.forEach(x=>{if((x.tags||[]).some(t=>t.toLowerCase().includes(q)))out.push({type:'Memo',title:x.title,page:'memo',id:x.id})});
  return out;
}
function tagSearchModuleV10(){
  return `<div class="card tag-search-card"><div class="section-title"><h2>🏷 标签检索</h2></div><input id="tagSearchInputV10" placeholder="输入标签，例如 Memory / AMO / 月次" value="${esc(tagSearchTextV10)}" oninput="updateTagSearchV10(this.value)"><div id="tagSearchResultsV10" class="list" style="margin-top:12px"></div></div>`;
}
function updateTagSearchV10(v){
  tagSearchTextV10=v||'';
  const root=document.getElementById('tagSearchResultsV10');if(!root)return;
  const rows=unifiedTagResults(tagSearchTextV10);
  root.innerHTML=rows.map(r=>`<button class="item tag-result-item" onclick="openTagResultV10('${r.page}','${r.id||''}')"><span class="pill">${r.type}</span> ${esc(r.title)}</button>`).join('')||(tagSearchTextV10?'<div class="empty small-empty">没有匹配内容</div>':'');
}
function openTagResultV10(page,id){
  goPage(page);
  setTimeout(()=>{
    if(page==='kanban'&&id)openKanbanCard(id);
    if(page==='projects'&&id)openProject(id);
    if(page==='memo'&&id){activeMemoId=id;renderMemo();}
  },30);
}

/* ---------- Today layout ---------- */
function renderToday(){
  ensureRecurringKanban();
  const d=todayISO(),rs=state.routines.filter(r=>isRoutineDue(r,d)),done=rs.filter(r=>getRLog(d,r.id)?.status==='done').length;
  const activeP=state.projects.filter(p=>p.status!=='done'&&!p.completedAt);
  const activeK=state.kanban.filter(x=>!x.completedAt&&!x.archived&&String(columnForCard(x)?.name||x.status).toUpperCase()!=='DONE');
  const recentProjects=[...state.projects].sort((a,b)=>(b.createdAt||b.startedAt||0)-(a.createdAt||a.startedAt||0)).slice(0,5);
  $('#page-today').innerHTML=`<div class="grid grid-3">
    <button class="card kpi-link" onclick="goPage('routine')"><div class="kpi">${done}/${rs.length}</div><div class="kpi-label">今日 Routine →</div></button>
    <button class="card kpi-link" onclick="goPage('projects')"><div class="kpi">${activeP.length}</div><div class="kpi-label">长期任务 / Projects →</div></button>
    <button class="card kpi-link" onclick="goPage('kanban')"><div class="kpi">${activeK.length}</div><div class="kpi-label">Kanban 未完成 →</div></button>
  </div>
  <div class="grid today-top-row" style="margin-top:18px">
    <div class="card"><div class="section-title"><h2>🗂 长期任务</h2><button class="small-btn" onclick="goPage('projects')">全部</button></div>${recentProjects.map(projectSummary).join('')||'<div class="empty">还没有长期任务</div>'}</div>
    ${tagSearchModuleV10()}
  </div>
  <div class="today-work-calendar-grid" style="margin-top:18px">
    <div class="today-left-stack">
      <div class="card"><div class="section-title"><h2>今日 Routine</h2><button class="small-btn" onclick="goPage('routine')">历史</button></div>${rs.map(r=>routineItem(r,d)).join('')}</div>
      <div class="card"><div class="section-title"><h2>📊 Kanban</h2><button class="small-btn" onclick="goPage('kanban')">打开看板</button></div><div class="today-column-groups">${state.kanbanColumns.map(todayColumnGroup).join('')}</div></div>
    </div>
    <div class="card today-calendar-side"><div class="section-title"><h2>📅 Routine + Kanban 日历</h2></div>${combinedCalendar(todayCalMonth,'todayCalendarShift')}</div>
  </div>`;
  setTimeout(()=>updateTagSearchV10(tagSearchTextV10),0);
}
/* ======================= END V10 OVERRIDES ======================= */


/* ======================= V10.1 OVERRIDES ======================= */
function kanbanTasksForCardV101(t){
  if(Array.isArray(t.checks)&&countTasks(t.checks).all)return t.checks;
  if(!t.html)return [];
  const box=document.createElement('div');box.innerHTML=t.html;
  const roots=[...box.querySelectorAll('.inline-task')].filter(el=>!el.parentElement.closest('.inline-task'));
  return roots.map(collectInlineTaskEl).filter(x=>x.text);
}
function cardHtml(t,c=null){
  c=c||columnForCard(t); const tasks=kanbanTasksForCardV101(t),n=countTasks(tasks);
  const search=((t.title||'')+' '+(t.tags||[]).join(' ')).toLowerCase();
  return `<div class="task-card ${t.completedAt?'done-card':''}" data-search="${esc(search)}" draggable="true" style="background:${cardColorFor(t,c)}" ondragstart="event.dataTransfer.setData('text/plain','${t.id}')">
    ${kanbanMiniActions(t)}<div class="card-topline"><input class="main-check" type="checkbox" ${t.completedAt?'checked':''} onclick="event.stopPropagation()" onchange="finishKanbanTask('${t.id}',this.checked)"><div class="card-body" onclick="openKanbanCard('${t.id}')"><div class="item-title">${esc(t.title)}</div><div class="tags">${tagHtml(t.tags)}</div><div class="item-meta">Start ${fmtTime(t.startedAt)} · Done ${fmtTime(t.completedAt)} · ${n.done}/${n.all} 子任务</div>${t.plannedStartAt?`<span class="micro-due">计划开始 ${esc(t.plannedStartAt.replace('T',' '))}</span>`:''}${t.dueAt?`<span class="micro-due ${dueClass(t.dueAt)}">${dueText(t.dueAt)}</span>`:''}</div></div>${t.showMemo&&t.html?`<div class="rich-preview compact-preview">${t.html}</div>`:''}${n.all?`<div class="sub-list">${taskQuickTree(tasks,'kanban',t.id)}</div>`:''}</div>`;
}
async function saveKanbanDrawer(id){
  let t=id?state.kanban.find(x=>x.id===id):{id:uid(),images:[],startedAt:null,completedAt:null,showMemo:false,archived:false};
  const tasks=collectInlineTasks('kanbanRich');
  Object.assign(t,{title:$('#kcTitle').value.trim(),status:$('#kcStatus').value,tags:splitTags($('#kcTags').value),html:$('#kanbanRich').innerHTML,checks:structuredClone(tasks),plannedStartAt:$('#kcPlanned').value,dueAt:$('#kcDue').value,cardColor:$('#kcColor').value});
  if(tasks.length&&tasksAllDone(tasks)&&!t.completedAt){if(!t.startedAt)t.startedAt=Date.now();t.completedAt=Date.now();t.status=state.kanbanColumns.find(c=>String(c.name).toUpperCase()==='DONE')?.id||'done';}
  if(!id)state.kanban.push(t);
  const rule=state.kanbanRecurring?.find(r=>r.sourceCardId===t.id);if(rule)rule.snapshot=recurringSnapshotFromCard(t);
  await saveState();closeDrawer();renderKanban();
}
/* ======================= END V10.1 ======================= */


/* ======================= V10.2 KANBAN TASK FIX ======================= */

/* Current rich-task DOM has .inline-task-text directly inside .inline-task.
   Older builds used .inline-task-head. Support both and recurse only through
   the current task's direct .inline-children container. */
function collectInlineTaskEl(el){
  const directText =
    el.querySelector(':scope > .inline-task-text') ||
    el.querySelector(':scope > .inline-task-head > .inline-task-text');

  let childContainer=null;
  const wrap=el.closest('.inline-task-wrap');
  if(wrap){
    childContainer=[...wrap.children].find(x=>x.classList?.contains('inline-children'))||null;
  }else{
    childContainer=[...el.children].find(x=>x.classList?.contains('inline-children'))||null;
  }

  const childTaskEls=childContainer
    ? [...childContainer.children]
        .map(x=>x.classList?.contains('inline-task-wrap') ? x.querySelector(':scope > .inline-task') : (x.classList?.contains('inline-task')?x:null))
        .filter(Boolean)
    : [];

  return {
    id:el.dataset.taskId||uid(),
    text:(directText?.innerText||directText?.textContent||'').trim(),
    dueAt:el.dataset.due||'',
    startedAt:el.dataset.started?Number(el.dataset.started):null,
    completedAt:el.dataset.completed?Number(el.dataset.completed):null,
    done:!!el.dataset.completed,
    children:childTaskEls.map(collectInlineTaskEl).filter(x=>x.text)
  };
}

function collectInlineTasks(editorId){
  const ed=document.getElementById(editorId);
  if(!ed)return[];

  const roots=[...ed.children].flatMap(node=>{
    if(node.classList?.contains('inline-task-wrap')){
      const t=node.querySelector(':scope > .inline-task');
      return t?[t]:[];
    }
    if(node.classList?.contains('inline-task'))return[node];
    return [...node.querySelectorAll?.(':scope > .inline-task-wrap > .inline-task')||[]];
  });

  /* Fallback for content pasted/wrapped by the browser. */
  const usable=roots.length?roots:
    [...ed.querySelectorAll('.inline-task')].filter(el=>{
      const parentWrap=el.closest('.inline-task-wrap');
      return !parentWrap?.parentElement?.closest('.inline-task-wrap');
    });

  return usable.map(collectInlineTaskEl).filter(x=>x.text);
}

/* For existing V10.1 cards that have 0/0 checks but still retain rich HTML,
   recover the task tree directly from their saved Memo HTML. */
function kanbanTasksForCardV102(t){
  if(Array.isArray(t.checks)&&countTasks(t.checks).all)return t.checks;
  if(!t.html)return[];

  const box=document.createElement('div');
  box.innerHTML=t.html;

  const roots=[...box.children].flatMap(node=>{
    if(node.classList?.contains('inline-task-wrap')){
      const task=node.querySelector(':scope > .inline-task');
      return task?[task]:[];
    }
    if(node.classList?.contains('inline-task'))return[node];
    return [];
  });

  const usable=roots.length?roots:
    [...box.querySelectorAll('.inline-task')].filter(el=>{
      const wrap=el.closest('.inline-task-wrap');
      return !wrap?.parentElement?.closest('.inline-task-wrap');
    });

  return usable.map(collectInlineTaskEl).filter(x=>x.text);
}

function cardHtml(t,c=null){
  c=c||columnForCard(t);
  const tasks=kanbanTasksForCardV102(t),n=countTasks(tasks);
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
    ${n.all?`<div class="sub-list">${taskQuickTree(tasks,'kanban',t.id)}</div>`:''}
  </div>`;
}

async function saveKanbanDrawer(id){
  let t=id?state.kanban.find(x=>x.id===id):{
    id:uid(),images:[],startedAt:null,completedAt:null,showMemo:false,archived:false
  };
  const tasks=collectInlineTasks('kanbanRich');

  Object.assign(t,{
    title:$('#kcTitle').value.trim(),
    status:$('#kcStatus').value,
    tags:splitTags($('#kcTags').value),
    html:$('#kanbanRich').innerHTML,
    checks:structuredClone(tasks),
    plannedStartAt:$('#kcPlanned').value,
    dueAt:$('#kcDue').value,
    cardColor:$('#kcColor').value
  });

  if(tasks.length&&tasksAllDone(tasks)&&!t.completedAt){
    if(!t.startedAt)t.startedAt=Date.now();
    t.completedAt=Date.now();
    t.status=state.kanbanColumns.find(c=>String(c.name).toUpperCase()==='DONE')?.id||'done';
  }

  if(!id)state.kanban.push(t);

  const rule=state.kanbanRecurring?.find(r=>r.sourceCardId===t.id);
  if(rule)rule.snapshot=recurringSnapshotFromCard(t);

  await saveState();
  closeDrawer();
  renderKanban();
}
/* ======================= END V10.2 ======================= */


/* ======================= V10.3 TASK TREE + PLANNED START ======================= */

function inlineTaskMarkup(t={}){
  const id=t.id||uid();
  const title=esc(t.text||t.title||'新子任务');
  const planned=esc(t.plannedStartAt||'');
  const due=esc(t.dueAt||'');
  const st=t.startedAt||'';
  const done=t.completedAt||'';
  const checked=t.done||t.completedAt;
  const children=t.children||[];
  return `<div class="inline-task-wrap" data-wrapper-id="${id}">
    <span class="inline-task"
      data-task-id="${id}"
      data-planned="${planned}"
      data-started="${st||''}"
      data-completed="${done||''}"
      data-due="${due}"
      contenteditable="false">
      <button type="button" class="inline-start task-icon" title="Start" onclick="inlineTaskStart(this)">▶</button>
      <input type="checkbox" ${checked?'checked':''} onchange="inlineTaskDone(this)">
      <span class="inline-task-text" contenteditable="true">${title}</span>
      <button type="button" class="inline-up task-icon" title="上移" onclick="moveInlineTask(this,-1)">↑</button>
      <button type="button" class="inline-down task-icon" title="下移" onclick="moveInlineTask(this,1)">↓</button>
      <button type="button" class="inline-planned task-icon" title="预计开始时间" onclick="inlineTaskPlanned(this)">📅</button>
      <button type="button" class="inline-due task-icon" title="预计完成时间" onclick="inlineTaskDue(this)">⏰</button>
      <button type="button" class="inline-child task-icon" title="添加下级子任务" onclick="inlineTaskChild(this)">↳＋</button>
      <button type="button" class="inline-delete task-icon danger-icon" title="删除这个子任务" onclick="removeInlineTask(this)">✕</button>
      <span class="inline-task-meta">${taskMetaTextV103({plannedStartAt:planned,startedAt:st?Number(st):null,dueAt:due,completedAt:done?Number(done):null})}</span>
    </span>
    <div class="inline-children">${children.map(inlineTaskMarkup).join('')}</div>
  </div>`;
}

function taskMetaTextV103(t){
  const parts=[];
  if(t.plannedStartAt)parts.push('计划 '+String(t.plannedStartAt).replace('T',' '));
  parts.push(t.startedAt?('Start '+fmtTime(Number(t.startedAt))):'未开始');
  if(t.dueAt)parts.push('预计完成 '+String(t.dueAt).replace('T',' '));
  if(t.completedAt)parts.push('Done '+fmtTime(Number(t.completedAt)));
  return parts.join(' · ');
}

function inlineTaskPlanned(btn){
  const el=btn.closest('.inline-task');if(!el)return;
  const cur=(el.dataset.planned||'').replace('T',' ');
  const v=prompt('预计开始时间（例如 2026-09-01 09:00；留空清除）',cur);
  if(v===null)return;
  el.dataset.planned=v.trim()?v.trim().replace(' ','T'):'';
  refreshInlineTaskV103(el);
}
function refreshInlineTaskV103(el){
  const st=el.dataset.started?Number(el.dataset.started):null;
  const done=el.dataset.completed?Number(el.dataset.completed):null;
  const due=el.dataset.due||'';
  const planned=el.dataset.planned||'';
  const meta=el.querySelector('.inline-task-meta');
  if(meta)meta.textContent=taskMetaTextV103({plannedStartAt:planned,startedAt:st,dueAt:due,completedAt:done});
  const cb=el.querySelector('input[type=checkbox]');if(cb)cb.checked=!!done;
}
function inlineTaskStart(btn){
  const el=btn.closest('.inline-task');if(!el)return;
  if(!el.dataset.started)el.dataset.started=String(Date.now());
  refreshInlineTaskV103(el);
}
function inlineTaskDone(cb){
  const el=cb.closest('.inline-task');if(!el)return;
  if(cb.checked){
    if(!el.dataset.started)el.dataset.started=String(Date.now());
    el.dataset.completed=String(Date.now());
  }else el.dataset.completed='';
  refreshInlineTaskV103(el);
}
function inlineTaskDue(btn){
  const el=btn.closest('.inline-task');if(!el)return;
  const cur=(el.dataset.due||'').replace('T',' ');
  const v=prompt('预计完成时间（例如 2026-09-05 18:00；留空清除）',cur);
  if(v===null)return;
  el.dataset.due=v.trim()?v.trim().replace(' ','T'):'';
  refreshInlineTaskV103(el);
}

/* Parse one task and recurse through only its direct child container. */
function collectInlineTaskEl(el){
  const txt=el.querySelector(':scope > .inline-task-text') ||
            el.querySelector(':scope > .inline-task-head > .inline-task-text');
  const wrap=el.closest('.inline-task-wrap');
  let childContainer=null;
  if(wrap){
    childContainer=[...wrap.children].find(n=>n.classList?.contains('inline-children'))||null;
  }
  const childEls=[];
  if(childContainer){
    [...childContainer.children].forEach(node=>{
      if(node.classList?.contains('inline-task-wrap')){
        const x=[...node.children].find(n=>n.classList?.contains('inline-task'));
        if(x)childEls.push(x);
      }else if(node.classList?.contains('inline-task')){
        childEls.push(node);
      }
    });
  }
  return {
    id:el.dataset.taskId||uid(),
    text:(txt?.innerText||txt?.textContent||'').trim(),
    plannedStartAt:el.dataset.planned||'',
    dueAt:el.dataset.due||'',
    startedAt:el.dataset.started?Number(el.dataset.started):null,
    completedAt:el.dataset.completed?Number(el.dataset.completed):null,
    done:!!el.dataset.completed,
    children:childEls.map(collectInlineTaskEl).filter(x=>x.text)
  };
}

/* Robust root detection:
   every .inline-task is a root if it has no ancestor .inline-task-wrap inside the same editor.
   This works whether the browser wrapped sibling tasks in div/p/br nodes. */
function collectTaskTreeFromRootV103(root){
  if(!root)return[];
  const all=[...root.querySelectorAll('.inline-task')];
  const roots=all.filter(el=>{
    const ownWrap=el.closest('.inline-task-wrap');
    if(!ownWrap)return !el.parentElement?.closest('.inline-task');
    let p=ownWrap.parentElement;
    while(p && p!==root){
      if(p.classList?.contains('inline-task-wrap'))return false;
      p=p.parentElement;
    }
    return true;
  });
  return roots.map(collectInlineTaskEl).filter(x=>x.text);
}
function collectInlineTasks(editorId){
  return collectTaskTreeFromRootV103(document.getElementById(editorId));
}
function kanbanTasksForCardV103(t){
  if(Array.isArray(t.checks) && countTasks(t.checks).all)return t.checks;
  if(!t.html)return[];
  const box=document.createElement('div');box.innerHTML=t.html;
  return collectTaskTreeFromRootV103(box);
}

/* Upgrade stored old tasks with planned-start button and metadata. */
function upgradeRichEditorTasks(root){
  if(!root)return;
  root.querySelectorAll('.inline-task').forEach(task=>{
    task.setAttribute('contenteditable','false');
    task.dataset.planned??='';
    const add=(cls,text,title)=>{
      if(task.querySelector(':scope > .'+cls))return;
      const b=document.createElement('button');b.type='button';b.className=`${cls} task-icon`;b.title=title;b.textContent=text;
      task.insertBefore(b,task.querySelector(':scope > .inline-task-meta')||null);
    };
    add('inline-up','↑','上移');
    add('inline-down','↓','下移');
    add('inline-planned','📅','预计开始时间');
    add('inline-due','⏰','预计完成时间');
    add('inline-child','↳＋','添加下级子任务');
    add('inline-delete','✕','删除这个子任务');
    refreshInlineTaskV103(task);
  });
}

function taskQuickTree(tasks,ownerType,ownerId,depth=0){
  return (tasks||[]).map(t=>`<div class="sub-inline nested-${Math.min(depth,5)}">
    <input type="checkbox" ${t.done||t.completedAt?'checked':''} onchange="toggleQuickTask('${ownerType}','${ownerId}','${t.id}',this.checked)">
    <span class="sub-name">${depth?'<span class="tree-branch">↳</span> ':''}${esc(t.text||t.title)}</span>
    ${!t.startedAt?`<button class="micro-btn" title="Start" onclick="startQuickTask('${ownerType}','${ownerId}','${t.id}')">▶</button>`:`<span class="micro-time">${fmtTime(t.startedAt)}${t.completedAt?'→'+fmtTime(t.completedAt):''}</span>`}
    ${t.plannedStartAt?`<span class="micro-plan">计划 ${esc(String(t.plannedStartAt).replace('T',' '))}</span>`:''}
    ${t.dueAt?`<span class="micro-due ${dueClass(t.dueAt)}">${dueText(t.dueAt)}</span>`:''}
  </div>${taskQuickTree(t.children||[],ownerType,ownerId,depth+1)}`).join('');
}

function cardHtml(t,c=null){
  c=c||columnForCard(t);
  const tasks=kanbanTasksForCardV103(t),n=countTasks(tasks);
  const search=((t.title||'')+' '+(t.tags||[]).join(' ')).toLowerCase();
  return `<div class="task-card ${t.completedAt?'done-card':''}" data-search="${esc(search)}" draggable="true"
    style="background:${cardColorFor(t,c)}" ondragstart="event.dataTransfer.setData('text/plain','${t.id}')">
    ${kanbanMiniActions(t)}
    <div class="card-topline">
      <input class="main-check" type="checkbox" ${t.completedAt?'checked':''} onclick="event.stopPropagation()" onchange="finishKanbanTask('${t.id}',this.checked)">
      <div class="card-body" onclick="openKanbanCard('${t.id}')">
        <div class="item-title">${esc(t.title)}</div><div class="tags">${tagHtml(t.tags)}</div>
        <div class="item-meta">Start ${fmtTime(t.startedAt)} · Done ${fmtTime(t.completedAt)} · ${n.done}/${n.all} 子任务</div>
        ${t.plannedStartAt?`<span class="micro-due">计划开始 ${esc(t.plannedStartAt.replace('T',' '))}</span>`:''}
        ${t.dueAt?`<span class="micro-due ${dueClass(t.dueAt)}">${dueText(t.dueAt)}</span>`:''}
      </div>
    </div>
    ${t.showMemo&&t.html?`<div class="rich-preview compact-preview">${t.html}</div>`:''}
    ${n.all?`<div class="sub-list">${taskQuickTree(tasks,'kanban',t.id)}</div>`:''}
  </div>`;
}

async function saveKanbanDrawer(id){
  let t=id?state.kanban.find(x=>x.id===id):{id:uid(),images:[],startedAt:null,completedAt:null,showMemo:false,archived:false};
  const tasks=collectInlineTasks('kanbanRich');
  Object.assign(t,{
    title:$('#kcTitle').value.trim(),status:$('#kcStatus').value,tags:splitTags($('#kcTags').value),
    html:$('#kanbanRich').innerHTML,checks:structuredClone(tasks),
    plannedStartAt:$('#kcPlanned').value,dueAt:$('#kcDue').value,cardColor:$('#kcColor').value
  });
  if(tasks.length&&tasksAllDone(tasks)&&!t.completedAt){
    if(!t.startedAt)t.startedAt=Date.now();t.completedAt=Date.now();
    t.status=state.kanbanColumns.find(c=>String(c.name).toUpperCase()==='DONE')?.id||'done';
  }
  if(!id)state.kanban.push(t);
  const rule=state.kanbanRecurring?.find(r=>r.sourceCardId===t.id);
  if(rule)rule.snapshot=recurringSnapshotFromCard(t);
  await saveState();closeDrawer();renderKanban();
}

/* Project uses the exact same rich task data, so plannedStartAt is automatically saved too. */
async function saveProjectDrawerV9(id){
  const p=state.projects.find(x=>x.id===id);
  const tasks=collectInlineTasks('projectRich').map(x=>({...x,title:x.text,note:''}));
  Object.assign(p,{
    title:$('#pdTitle').value.trim(),categoryId:$('#pdCat').value,
    plannedStartAt:$('#pdPlanned').value,dueAt:$('#pdDue').value,
    status:$('#pdStatus').value,tags:splitTags($('#pdTags').value),
    html:$('#projectRich').innerHTML,subtasks:tasks,
    handoffs:collectRichNotes('handoffs'),reports:collectRichNotes('reports'),
    questions:collectRichNotes('questions'),investigations:collectRichNotes('investigations')
  });
  if(p.subtasks.length&&p.subtasks.every(x=>x.done||x.completedAt)&&!p.completedAt){
    if(!p.startedAt)p.startedAt=Date.now();p.completedAt=Date.now();p.status='done';
  }
  await saveState();closeDrawer();renderProjects();toast('项目已保存');
}
/* ======================= END V10.3 ======================= */


/* ======================= V10.4 RICH BLANK-LINE + TASK HIERARCHY ======================= */

/* ---------- remove empty rich-text blocks with Backspace/Delete ---------- */
function isEmptyRichBlockV104(node){
  if(!node || node.nodeType!==1)return false;
  if(node.matches('.inline-task-wrap,.inline-task,.inline-children'))return false;
  if(node.querySelector('.inline-task,.inline-task-wrap,img,video,iframe,input,button'))return false;
  const text=(node.textContent||'').replace(/\u200B|\u00A0/g,'').trim();
  const onlyBreaks=[...node.childNodes].every(n=>{
    if(n.nodeType===3)return !(n.textContent||'').replace(/\u200B|\u00A0/g,'').trim();
    return n.nodeType===1 && n.tagName==='BR';
  });
  return !text && onlyBreaks;
}

function closestDirectRichBlockV104(editor,node){
  if(!editor||!node)return null;
  let el=node.nodeType===1?node:node.parentElement;
  while(el && el.parentElement!==editor){
    if(el.classList?.contains('inline-task-wrap'))return null;
    el=el.parentElement;
  }
  return el && el.parentElement===editor ? el : null;
}

function placeCaretNearRemovedV104(editor,removedIndex){
  const candidates=[...editor.childNodes].filter(n=>n.nodeType===1||n.nodeType===3);
  const target=candidates[Math.min(Math.max(removedIndex-1,0),candidates.length-1)]||editor;
  const range=document.createRange(),sel=window.getSelection();
  try{
    range.selectNodeContents(target);
    range.collapse(false);
    sel.removeAllRanges();sel.addRange(range);
  }catch{}
}

document.addEventListener('keydown',e=>{
  if(e.key!=='Backspace' && e.key!=='Delete')return;
  const editor=e.target.closest?.('.rich-editor');
  if(!editor)return;

  const sel=window.getSelection();
  if(!sel || !sel.rangeCount || !sel.isCollapsed)return;

  const block=closestDirectRichBlockV104(editor,sel.anchorNode);
  if(block && isEmptyRichBlockV104(block)){
    e.preventDefault();
    const idx=[...editor.childNodes].indexOf(block);
    block.remove();
    placeCaretNearRemovedV104(editor,idx);
    return;
  }

  /* Browser sometimes leaves bare <br> as an empty row. */
  if(sel.anchorNode===editor){
    const offset=sel.anchorOffset;
    const node=editor.childNodes[offset] || editor.childNodes[offset-1];
    if(node?.nodeType===1 && isEmptyRichBlockV104(node)){
      e.preventDefault();
      const idx=[...editor.childNodes].indexOf(node);
      node.remove();
      placeCaretNearRemovedV104(editor,idx);
    }
  }
},true);

/* Also clean useless empty rows on save, but keep intentional text, images and tasks. */
function cleanRichEditorBlankLinesV104(editor){
  if(!editor)return;
  [...editor.children].forEach(ch=>{
    if(isEmptyRichBlockV104(ch))ch.remove();
  });
}

/* ---------- task hierarchy controls ---------- */
function taskWrapDirectParentV104(wrap){
  const p=wrap?.parentElement;
  if(!p)return null;
  if(p.classList?.contains('inline-children')){
    return p.closest('.inline-task-wrap');
  }
  return null;
}

function previousTaskSiblingV104(wrap){
  let prev=wrap?.previousElementSibling;
  while(prev && !prev.classList?.contains('inline-task-wrap'))prev=prev.previousElementSibling;
  return prev||null;
}

/* Make current task a child of the previous sibling. */
function indentTaskHierarchyV104(btn){
  const wrap=btn.closest('.inline-task-wrap');if(!wrap)return;
  const prev=previousTaskSiblingV104(wrap);
  if(!prev){toast('前面没有可以作为父任务的任务');return;}

  let children=[...prev.children].find(n=>n.classList?.contains('inline-children'));
  if(!children){
    children=document.createElement('div');
    children.className='inline-children';
    prev.appendChild(children);
  }
  children.appendChild(wrap);
}

/* Promote current task one level upward, placing it after its former parent. */
function outdentTaskHierarchyV104(btn){
  const wrap=btn.closest('.inline-task-wrap');if(!wrap)return;
  const parentWrap=taskWrapDirectParentV104(wrap);
  if(!parentWrap){toast('已经是最上层任务');return;}

  const parentContainer=parentWrap.parentElement;
  parentContainer.insertBefore(wrap,parentWrap.nextElementSibling);
}

/* Current task markup with hierarchy buttons. */
function inlineTaskMarkup(t={}){
  const id=t.id||uid(),title=esc(t.text||t.title||'新子任务');
  const planned=esc(t.plannedStartAt||''),due=esc(t.dueAt||''),st=t.startedAt||'',done=t.completedAt||'';
  const checked=t.done||t.completedAt,children=t.children||[];
  return `<div class="inline-task-wrap" data-wrapper-id="${id}">
    <span class="inline-task" data-task-id="${id}" data-planned="${planned}" data-started="${st||''}" data-completed="${done||''}" data-due="${due}" contenteditable="false">
      <button type="button" class="inline-start task-icon" title="Start" onclick="inlineTaskStart(this)">▶</button>
      <input type="checkbox" ${checked?'checked':''} onchange="inlineTaskDone(this)">
      <span class="inline-task-text" contenteditable="true">${title}</span>
      <button type="button" class="inline-up task-icon" title="上移" onclick="moveInlineTask(this,-1)">↑</button>
      <button type="button" class="inline-down task-icon" title="下移" onclick="moveInlineTask(this,1)">↓</button>
      <button type="button" class="inline-level-in task-icon" title="变成上一条任务的次级任务" onclick="indentTaskHierarchyV104(this)">↪</button>
      <button type="button" class="inline-level-out task-icon" title="提升一级" onclick="outdentTaskHierarchyV104(this)">↩</button>
      <button type="button" class="inline-planned task-icon" title="预计开始时间" onclick="inlineTaskPlanned(this)">📅</button>
      <button type="button" class="inline-due task-icon" title="预计完成时间" onclick="inlineTaskDue(this)">⏰</button>
      <button type="button" class="inline-child task-icon" title="直接新建下级子任务" onclick="inlineTaskChild(this)">↳＋</button>
      <button type="button" class="inline-delete task-icon danger-icon" title="删除这个子任务" onclick="removeInlineTask(this)">✕</button>
      <span class="inline-task-meta">${taskMetaTextV103({plannedStartAt:planned,startedAt:st?Number(st):null,dueAt:due,completedAt:done?Number(done):null})}</span>
    </span>
    <div class="inline-children">${children.map(inlineTaskMarkup).join('')}</div>
  </div>`;
}

/* Upgrade all V8~V10.3 stored task nodes with the two hierarchy buttons. */
function upgradeRichEditorTasks(root){
  if(!root)return;
  root.querySelectorAll('.inline-task').forEach(task=>{
    task.setAttribute('contenteditable','false');
    task.dataset.planned??='';
    const add=(cls,text,title,handler)=>{
      if(task.querySelector(':scope > .'+cls))return;
      const b=document.createElement('button');
      b.type='button';b.className=`${cls} task-icon`;b.title=title;b.textContent=text;b.onclick=handler;
      task.insertBefore(b,task.querySelector(':scope > .inline-task-meta')||null);
    };
    add('inline-up','↑','上移',function(){moveInlineTask(this,-1)});
    add('inline-down','↓','下移',function(){moveInlineTask(this,1)});
    add('inline-level-in','↪','变成上一条任务的次级任务',function(){indentTaskHierarchyV104(this)});
    add('inline-level-out','↩','提升一级',function(){outdentTaskHierarchyV104(this)});
    add('inline-planned','📅','预计开始时间',function(){inlineTaskPlanned(this)});
    add('inline-due','⏰','预计完成时间',function(){inlineTaskDue(this)});
    add('inline-child','↳＋','直接新建下级子任务',function(){inlineTaskChild(this)});
    add('inline-delete','✕','删除这个子任务',function(){removeInlineTask(this)});
    refreshInlineTaskV103(task);
  });
}

/* Capture hierarchy buttons too, for Edge/contenteditable reliability. */
document.addEventListener('click',e=>{
  const i=e.target.closest?.('.inline-level-in');
  if(i){e.preventDefault();e.stopPropagation();indentTaskHierarchyV104(i);return;}
  const o=e.target.closest?.('.inline-level-out');
  if(o){e.preventDefault();e.stopPropagation();outdentTaskHierarchyV104(o);return;}
},true);

/* ---------- save hooks: clean blank lines before serializing ---------- */
async function saveKanbanDrawer(id){
  const ed=$('#kanbanRich');cleanRichEditorBlankLinesV104(ed);
  let t=id?state.kanban.find(x=>x.id===id):{id:uid(),images:[],startedAt:null,completedAt:null,showMemo:false,archived:false};
  const tasks=collectInlineTasks('kanbanRich');
  Object.assign(t,{title:$('#kcTitle').value.trim(),status:$('#kcStatus').value,tags:splitTags($('#kcTags').value),html:ed.innerHTML,checks:structuredClone(tasks),plannedStartAt:$('#kcPlanned').value,dueAt:$('#kcDue').value,cardColor:$('#kcColor').value});
  if(tasks.length&&tasksAllDone(tasks)&&!t.completedAt){
    if(!t.startedAt)t.startedAt=Date.now();t.completedAt=Date.now();
    t.status=state.kanbanColumns.find(c=>String(c.name).toUpperCase()==='DONE')?.id||'done';
  }
  if(!id)state.kanban.push(t);
  const rule=state.kanbanRecurring?.find(r=>r.sourceCardId===t.id);if(rule)rule.snapshot=recurringSnapshotFromCard(t);
  await saveState();closeDrawer();renderKanban();
}

async function saveProjectDrawerV9(id){
  const ed=$('#projectRich');cleanRichEditorBlankLinesV104(ed);
  const p=state.projects.find(x=>x.id===id);
  const tasks=collectInlineTasks('projectRich').map(x=>({...x,title:x.text,note:''}));
  Object.assign(p,{title:$('#pdTitle').value.trim(),categoryId:$('#pdCat').value,plannedStartAt:$('#pdPlanned').value,dueAt:$('#pdDue').value,status:$('#pdStatus').value,tags:splitTags($('#pdTags').value),html:ed.innerHTML,subtasks:tasks,handoffs:collectRichNotes('handoffs'),reports:collectRichNotes('reports'),questions:collectRichNotes('questions'),investigations:collectRichNotes('investigations')});
  if(p.subtasks.length&&p.subtasks.every(x=>x.done||x.completedAt)&&!p.completedAt){
    if(!p.startedAt)p.startedAt=Date.now();p.completedAt=Date.now();p.status='done';
  }
  await saveState();closeDrawer();renderProjects();toast('项目已保存');
}

async function saveMemoV7(id){
  const m=state.memos.find(x=>x.id===id);if(!m)return;
  const ed=$('#memoRich');cleanRichEditorBlankLinesV104(ed);
  Object.assign(m,{title:$('#memoTitle').value.trim()||'Untitled Memo',tags:splitTags($('#memoTags').value),html:ed.innerHTML,checks:collectMemoChecks(m.checks||[]),updatedAt:Date.now()});
  await saveState();toast('Memo 已保存');renderMemo();
}

/* Generic helper for SOP/template editors: whenever their existing save code reads
   innerHTML, blank direct rows are already removed on focusout. */
document.addEventListener('focusout',e=>{
  const ed=e.target.closest?.('.rich-editor');
  if(ed)cleanRichEditorBlankLinesV104(ed);
},true);

/* ======================= END V10.4 ======================= */


/* ======================= V10.5 RICH EDITOR CONTINUE-TYPING FIX ======================= */

function makeEditableTailV105(){
  const div=document.createElement('div');
  div.className='rich-free-line';
  div.innerHTML='<br>';
  return div;
}

function setCaretInsideV105(el){
  if(!el)return;
  const range=document.createRange(),sel=window.getSelection();
  range.selectNodeContents(el);
  range.collapse(true);
  sel.removeAllRanges();
  sel.addRange(range);
  el.closest('.rich-editor')?.focus();
}

/* Make sure an editor never ends directly on a task block.
   Old saved cards are upgraded on open as well. */
function ensureRichEditableTailV105(editor){
  if(!editor)return;
  const last=editor.lastElementChild;
  if(!last){
    editor.appendChild(makeEditableTailV105());
    return;
  }
  if(last.classList?.contains('inline-task-wrap') || last.classList?.contains('inline-task')){
    editor.appendChild(makeEditableTailV105());
  }
}

/* Insert a top-level task and ALWAYS create a normal editable line after it. */
function insertInlineCheckbox(id){
  const ed=document.getElementById(id);
  if(!ed){toast('当前编辑框还没有准备好');return;}

  const holder=document.createElement('div');
  holder.innerHTML=inlineTaskMarkup({id:uid(),text:'新子任务',children:[]});
  const task=holder.firstElementChild;
  const tail=makeEditableTailV105();

  ed.focus();
  const sel=window.getSelection();

  if(sel && sel.rangeCount && ed.contains(sel.anchorNode)){
    const range=sel.getRangeAt(0);
    range.deleteContents();

    /* If caret is inside an ordinary text block, insert after the current line
       rather than splitting a task node. */
    let block=sel.anchorNode.nodeType===1?sel.anchorNode:sel.anchorNode.parentElement;
    while(block && block.parentElement!==ed && !block.classList?.contains('inline-task-wrap')){
      block=block.parentElement;
    }

    if(block && block.parentElement===ed && !block.classList?.contains('inline-task-wrap')){
      block.insertAdjacentElement('afterend',task);
      task.insertAdjacentElement('afterend',tail);
    }else{
      const frag=document.createDocumentFragment();
      frag.appendChild(task);
      frag.appendChild(tail);
      range.insertNode(frag);
    }
  }else{
    ed.appendChild(task);
    ed.appendChild(tail);
  }

  upgradeRichEditorTasks(ed);
  setCaretInsideV105(tail);
}

/* Clicking unused space at the bottom of a rich editor puts the caret in a
   normal text line instead of trapping focus on the last task. */
document.addEventListener('mousedown',e=>{
  const ed=e.target.closest?.('.rich-editor');
  if(!ed)return;
  if(e.target!==ed)return;
  ensureRichEditableTailV105(ed);
},true);

document.addEventListener('click',e=>{
  const ed=e.target.closest?.('.rich-editor');
  if(!ed || e.target!==ed)return;
  ensureRichEditableTailV105(ed);
  const tail=ed.lastElementChild;
  if(tail?.classList?.contains('rich-free-line'))setCaretInsideV105(tail);
},true);

/* When Enter is pressed while editing a task title, jump to a normal line
   below that top-level task instead of creating malformed content inside it. */
document.addEventListener('keydown',e=>{
  if(e.key!=='Enter')return;
  const text=e.target.closest?.('.inline-task-text');
  if(!text)return;
  e.preventDefault();

  const wrap=text.closest('.inline-task-wrap');
  const editor=text.closest('.rich-editor');
  if(!wrap||!editor)return;

  /* For a nested task, add the free line after its top-level ancestor so
     ordinary notes stay in the main Memo flow. */
  let top=wrap;
  while(top.parentElement?.closest?.('.inline-task-wrap')){
    const parent=top.parentElement.closest('.inline-task-wrap');
    if(!parent)break;
    top=parent;
  }

  let next=top.nextElementSibling;
  if(!next || !next.classList?.contains('rich-free-line')){
    next=makeEditableTailV105();
    top.insertAdjacentElement('afterend',next);
  }
  setCaretInsideV105(next);
},true);

/* Old cards / Project / SOP / Memo / Templates all get an editable tail. */
function hydrateAllRichEditors(){
  document.querySelectorAll('.rich-editor').forEach(ed=>{
    upgradeRichEditorTasks(ed);
    ensureRichEditableTailV105(ed);
  });
}

/* Blank-line cleaner must preserve the final typing line while editing.
   We only strip redundant empty rows on save and then leave one tail. */
function cleanRichEditorBlankLinesV104(editor){
  if(!editor)return;
  const empties=[...editor.children].filter(ch=>isEmptyRichBlockV104(ch));
  empties.forEach((ch,i)=>{
    const isLast=ch===editor.lastElementChild;
    if(!isLast)ch.remove();
  });
  ensureRichEditableTailV105(editor);
}

/* ======================= END V10.5 ======================= */


/* ======================= V10.6 RICH FLOW FIX ======================= */

function makeEditableFlowLineV106(){
  const line=document.createElement('div');
  line.className='rich-flow-line';
  line.setAttribute('contenteditable','true');
  line.innerHTML='<br>';
  return line;
}

function isTaskWrapV106(el){
  return !!el?.classList?.contains('inline-task-wrap');
}

function isFlowLineV106(el){
  return !!el?.classList?.contains('rich-flow-line');
}

/* Every top-level task gets an ordinary editable line immediately after it.
   This makes the editor behave like:
   text -> task -> text -> image -> task -> text
   instead of letting the contenteditable=false task trap the caret. */
function ensureFlowLinesV106(editor){
  if(!editor)return;

  const children=[...editor.children];
  for(const el of children){
    if(!isTaskWrapV106(el))continue;

    const next=el.nextElementSibling;
    if(!isFlowLineV106(next)){
      el.insertAdjacentElement('afterend',makeEditableFlowLineV106());
    }else{
      next.setAttribute('contenteditable','true');
    }
  }

  if(!editor.lastElementChild || isTaskWrapV106(editor.lastElementChild)){
    editor.appendChild(makeEditableFlowLineV106());
  }

  /* Convert V10.5 tail lines to the new explicit editable flow line. */
  editor.querySelectorAll(':scope > .rich-free-line').forEach(old=>{
    old.classList.remove('rich-free-line');
    old.classList.add('rich-flow-line');
    old.setAttribute('contenteditable','true');
    if(!old.innerHTML.trim())old.innerHTML='<br>';
  });
}

function setCaretInFlowLineV106(line,atEnd=false){
  if(!line)return;
  line.setAttribute('contenteditable','true');
  const range=document.createRange(),sel=window.getSelection();
  range.selectNodeContents(line);
  range.collapse(!atEnd);
  sel.removeAllRanges();
  sel.addRange(range);
  line.focus?.();
  line.closest('.rich-editor')?.focus();
}

/* Insert top-level task and leave the caret in a guaranteed editable row. */
function insertInlineCheckbox(id){
  const ed=document.getElementById(id);
  if(!ed){toast('当前编辑框还没有准备好');return;}

  ensureFlowLinesV106(ed);

  const holder=document.createElement('div');
  holder.innerHTML=inlineTaskMarkup({id:uid(),text:'新子任务',children:[]});
  const task=holder.firstElementChild;
  const line=makeEditableFlowLineV106();

  const sel=window.getSelection();
  let inserted=false;

  if(sel && sel.rangeCount && ed.contains(sel.anchorNode)){
    let block=sel.anchorNode.nodeType===1?sel.anchorNode:sel.anchorNode.parentElement;
    while(block && block.parentElement!==ed && !block.classList?.contains('inline-task-wrap')){
      block=block.parentElement;
    }

    if(block && block.parentElement===ed){
      if(isTaskWrapV106(block)){
        block.insertAdjacentElement('afterend',task);
        task.insertAdjacentElement('afterend',line);
      }else{
        block.insertAdjacentElement('afterend',task);
        task.insertAdjacentElement('afterend',line);
      }
      inserted=true;
    }
  }

  if(!inserted){
    ed.appendChild(task);
    ed.appendChild(line);
  }

  upgradeRichEditorTasks(ed);
  ensureFlowLinesV106(ed);
  setCaretInFlowLineV106(line);
}

/* Clicking the blank area below/around task blocks always gives a writable row. */
document.addEventListener('click',e=>{
  const ed=e.target.closest?.('.rich-editor');
  if(!ed)return;

  ensureFlowLinesV106(ed);

  if(e.target===ed){
    const line=[...ed.children].reverse().find(x=>isFlowLineV106(x));
    if(line)setCaretInFlowLineV106(line,true);
  }
},true);

/* Enter in a task title means: continue ordinary Memo text under that task. */
document.addEventListener('keydown',e=>{
  if(e.key!=='Enter')return;
  const text=e.target.closest?.('.inline-task-text');
  if(!text)return;

  e.preventDefault();
  e.stopPropagation();

  let wrap=text.closest('.inline-task-wrap');
  const ed=text.closest('.rich-editor');
  if(!wrap||!ed)return;

  /* For nested tasks, move to the flow line after the outermost top-level task. */
  let top=wrap;
  while(top.parentElement?.classList?.contains('inline-children')){
    const parent=top.parentElement.closest('.inline-task-wrap');
    if(!parent)break;
    top=parent;
  }

  ensureFlowLinesV106(ed);
  let line=top.nextElementSibling;
  if(!isFlowLineV106(line)){
    line=makeEditableFlowLineV106();
    top.insertAdjacentElement('afterend',line);
  }
  setCaretInFlowLineV106(line);
},true);

/* V10.8: removed obsolete V10.6 global paste listener. V10.7+ unified handler is the only paste path. */

/* Hydration for Kanban / Project / SOP / Memo / Template editors. */
function hydrateAllRichEditors(){
  document.querySelectorAll('.rich-editor').forEach(ed=>{
    upgradeRichEditorTasks(ed);
    ensureFlowLinesV106(ed);
  });
}

/* Keep one editable flow line after tasks while removing accidental duplicate blanks.
   We don't remove a flow line just because it is blank: it is the user's typing area. */
function cleanRichEditorBlankLinesV104(editor){
  if(!editor)return;
  [...editor.children].forEach(ch=>{
    if(isFlowLineV106(ch))return;
    if(isEmptyRichBlockV104(ch))ch.remove();
  });
  ensureFlowLinesV106(editor);
}

/* ======================= END V10.6 ======================= */


/* ======================= V10.7 UNIFIED INLINE IMAGE FIX ======================= */

/* Remember last caret inside each rich editor so toolbar/drop insertions go
   where the user was working instead of jumping to the end. */
const richCaretV107 = new Map();

document.addEventListener('selectionchange',()=>{
  const sel=window.getSelection();
  if(!sel || !sel.rangeCount)return;
  const node=sel.anchorNode;
  const el=node?.nodeType===1?node:node?.parentElement;
  const ed=el?.closest?.('.rich-editor');
  if(!ed?.id)return;
  try{
    richCaretV107.set(ed.id,sel.getRangeAt(0).cloneRange());
  }catch{}
});

function restoreRichCaretV107(ed){
  if(!ed)return false;
  const saved=richCaretV107.get(ed.id);
  if(!saved)return false;
  try{
    if(!ed.contains(saved.commonAncestorContainer))return false;
    const sel=window.getSelection();
    sel.removeAllRanges();sel.addRange(saved);
    return true;
  }catch{return false}
}

function insertInlineImageNodeV107(editorId,data){
  const ed=document.getElementById(editorId);
  if(!ed)return;

  ensureFlowLinesV106(ed);
  ed.focus();
  restoreRichCaretV107(ed);

  const img=document.createElement('img');
  img.src=data;
  img.alt='image';
  img.className='inline-rich-image';

  const sel=window.getSelection();
  if(sel && sel.rangeCount && ed.contains(sel.anchorNode)){
    const range=sel.getRangeAt(0);
    range.deleteContents();
    range.insertNode(img);

    const lineBreak=document.createElement('br');
    img.after(lineBreak);

    try{
      range.setStartAfter(lineBreak);
      range.collapse(true);
      sel.removeAllRanges();sel.addRange(range);
      richCaretV107.set(editorId,range.cloneRange());
    }catch{}
  }else{
    let line=[...ed.children].reverse().find(x=>x.classList?.contains('rich-flow-line'));
    if(!line){
      line=makeEditableFlowLineV106();
      ed.appendChild(line);
    }
    if(line.innerHTML==='<br>')line.innerHTML='';
    line.appendChild(img);
    line.appendChild(document.createElement('br'));
    setCaretInFlowLineV106(line,true);
  }

  ensureFlowLinesV106(ed);
}

/* Override old helper too, so toolbar image selection uses the same path. */
function insertImageAtCaret(id,data){
  insertInlineImageNodeV107(id,data);
}

/* ONE image wiring path only.
   IMPORTANT: no ed.onpaste here anymore.
   Paste is handled only by the single global handler below.
   Also ignore the historical callback so Memo no longer pushes the same image
   into m.images and re-renders the whole page. */
function wireImageDrop(zoneId,editorId,callback){
  const zone=zoneId?document.getElementById(zoneId):null;
  const ed=document.getElementById(editorId);
  if(!ed)return;

  /* Explicitly remove any old DOM0 paste handler left by earlier versions. */
  ed.onpaste=null;

  if(zone){
    zone.ondragover=e=>{
      e.preventDefault();
      zone.classList.add('drag-active-v107');
    };
    zone.ondragleave=()=>zone.classList.remove('drag-active-v107');
    zone.ondrop=e=>{
      e.preventDefault();
      zone.classList.remove('drag-active-v107');
      const files=[...e.dataTransfer.files].filter(f=>f?.type?.startsWith('image/'));
      if(!files.length)return;
      filesToData(files,im=>insertInlineImageNodeV107(editorId,im.data));
    };
  }

  /* Dropping directly onto the editor also inserts inline. */
  ed.ondragover=e=>e.preventDefault();
  ed.ondrop=e=>{
    e.preventDefault();
    const files=[...e.dataTransfer.files].filter(f=>f?.type?.startsWith('image/'));
    if(!files.length)return;
    filesToData(files,im=>insertInlineImageNodeV107(editorId,im.data));
  };
}

/* Replace V10.6 global paste path with a single guarded handler.
   stopImmediatePropagation prevents any older paste listener on document/editor
   from processing the same clipboard image again. */
document.addEventListener('paste',e=>{
  const ed=e.target.closest?.('.rich-editor');
  if(!ed)return;

  const items=[...(e.clipboardData?.items||[])];
  const images=items.filter(i=>i.type?.startsWith('image/'));
  if(!images.length)return;

  e.preventDefault();
  e.stopPropagation();
  e.stopImmediatePropagation();

  images.forEach(item=>{
    const file=item.getAsFile();
    if(!file)return;
    const reader=new FileReader();
    reader.onload=()=>insertInlineImageNodeV107(ed.id,reader.result);
    reader.readAsDataURL(file);
  });
},true);

/* Memo now treats rich-content images as part of memoRich only.
   Old historical m.images are still displayed so existing data is not lost,
   but newly pasted/dropped images no longer enter that separate array. */
function renderMemo(){
  if(!activeMemoId&&state.memos[0])activeMemoId=state.memos[0].id;
  const list=state.memos.filter(x=>!memoFilter||x.title.toLowerCase().includes(memoFilter.toLowerCase())||(x.tags||[]).some(t=>t.toLowerCase().includes(memoFilter.toLowerCase())));
  const m=state.memos.find(x=>x.id===activeMemoId);

  $('#page-memo').innerHTML=`<div class="grid memo-layout">
    <div class="card memo-list-panel"><div class="section-title"><h2>Memos</h2><button class="small-btn" onclick="newMemo()">＋</button></div>
      <input id="memoFilterInput" placeholder="标题 / 标签筛选" value="${esc(memoFilter)}" oninput="filterMemoList(this.value)">
      <div id="memoListItems" class="list" style="margin-top:12px">${list.map(x=>`<button class="item memo-list-item ${x.id===activeMemoId?'selected':''}" data-search="${esc((x.title+' '+(x.tags||[]).join(' ')).toLowerCase())}" onclick="activeMemoId='${x.id}';renderMemo()"><div class="item-title">${esc(x.title)}</div><div class="tags">${tagHtml(x.tags)}</div><div class="item-meta">${new Date(x.updatedAt||Date.now()).toLocaleString()}</div></button>`).join('')||'<div class="empty">还没有 Memo</div>'}</div>
    </div>
    <div class="card memo-editor-panel">${m?memoEditorV107(m):'<div class="empty">点击左边 Memo，或新建一个 Memo</div>'}</div>
  </div>`;

  if(m)wireImageDrop('memoDrop','memoRich');
  setTimeout(hydrateAllRichEditors,0);
}

function memoEditorV107(m){
  return `<div class="form-row"><input id="memoTitle" value="${esc(m.title)}"><input id="memoTags" placeholder="标签" value="${esc((m.tags||[]).join(', '))}"></div>
    <h3>内容</h3>
    ${richEditor('memoRich',m.html||'','文字、子任务、图片、链接可自由混排…')}
    <div id="memoDrop" class="drop-zone">Ctrl+V 直接粘贴到上面的内容框，或拖图片到这里</div>
    ${(m.images||[]).length?`<details class="legacy-images-v107"><summary>旧版本独立图片 (${m.images.length})</summary>${imageGrid(m.images,'memo',m.id)}</details>`:''}
    <div class="modal-actions"><button class="ghost-btn" onclick="saveMemoAsTemplate('${m.id}')">☆ 保存为模板</button><button class="danger-btn" onclick="deleteMemo('${m.id}')">删除 Memo</button><button class="primary-btn" onclick="saveMemoV7('${m.id}')">保存</button></div>`;
}

/* ======================= END V10.7 ======================= */


/* ======================= V10.8 SINGLE-PASTE GUARANTEE ======================= */
let lastRichPasteSignatureV108='';
let lastRichPasteAtV108=0;

function richPasteSignatureV108(file,editorId){
  return `${editorId}|${file?.type||''}|${file?.size||0}|${file?.name||''}|${file?.lastModified||0}`;
}

/* Redefine wiring one last time: paste is NEVER attached here. */
function wireImageDrop(zoneId,editorId,callback){
  const zone=zoneId?document.getElementById(zoneId):null;
  const ed=document.getElementById(editorId);
  if(!ed)return;

  ed.onpaste=null;

  if(zone){
    zone.ondragover=e=>{e.preventDefault();zone.classList.add('drag-active-v107')};
    zone.ondragleave=()=>zone.classList.remove('drag-active-v107');
    zone.ondrop=e=>{
      e.preventDefault();
      e.stopPropagation();
      zone.classList.remove('drag-active-v107');
      const files=[...e.dataTransfer.files].filter(f=>f?.type?.startsWith('image/'));
      files.forEach(file=>{
        const reader=new FileReader();
        reader.onload=()=>insertInlineImageNodeV107(editorId,reader.result);
        reader.readAsDataURL(file);
      });
    };
  }

  ed.ondragover=e=>e.preventDefault();
  ed.ondrop=e=>{
    e.preventDefault();
    e.stopPropagation();
    const files=[...e.dataTransfer.files].filter(f=>f?.type?.startsWith('image/'));
    files.forEach(file=>{
      const reader=new FileReader();
      reader.onload=()=>insertInlineImageNodeV107(editorId,reader.result);
      reader.readAsDataURL(file);
    });
  };
}
/* ======================= END V10.8 ======================= */


/* ======================= V10.11 STABLE RECURRENCE ======================= */
/* Built on V10.8 stable UI. Only recurrence-related functions are overridden. */

function recDatePartsV1011(ds){
  const [y,m,d]=String(ds).slice(0,10).split('-').map(Number);
  const dt=new Date(y,m-1,d);
  return {y,m,d,wd:dt.getDay(),dt};
}
function recISOFromDateV1011(dt){
  return `${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,'0')}-${String(dt.getDate()).padStart(2,'0')}`;
}
function recLastDayV1011(y,m){return new Date(y,m,0).getDate()}
function recMonthsDiffV1011(a,b){return (b.getFullYear()-a.getFullYear())*12+(b.getMonth()-a.getMonth())}

function legacyRoutineConditionV1011(r){
  if(r.repeat==='daily')return {type:'daily'};
  if(r.repeat==='weekdays')return {type:'weekly',weekdays:[1,2,3,4,5]};
  return {type:'weekly',weekdays:(r.weekdays||[]).map(Number)};
}
function legacyKanbanConditionV1011(r){
  if(r.frequency==='daily')return {type:'daily'};
  if(r.frequency==='weekly')return {type:'weekly',weekdays:[Number(r.weekday??1)]};
  if(r.frequency==='yearly')return {type:'yearly',months:[Number(r.monthOfYear||1)],day:Number(r.dayOfMonth||1)};
  return {type:'monthly',day:Number(r.dayOfMonth||1)};
}
function condMatchV1011(c,ds){
  const p=recDatePartsV1011(ds), type=c?.type||'weekly';
  if(type==='daily')return true;
  if(type==='weekly')return (c.weekdays||[]).map(Number).includes(p.wd);
  if(type==='monthend')return p.d===recLastDayV1011(p.y,p.m);
  if(type==='monthly'){
    if(c.monthEnd)return p.d===recLastDayV1011(p.y,p.m);
    return p.d===Math.min(Number(c.day||1),recLastDayV1011(p.y,p.m));
  }
  if(type==='quarterly'){
    const ap=recDatePartsV1011(c.anchorDate||todayISO());
    const diff=recMonthsDiffV1011(ap.dt,p.dt);
    if(diff<0||diff%3!==0)return false;
    if(c.monthEnd)return p.d===recLastDayV1011(p.y,p.m);
    return p.d===Math.min(Number(c.day||ap.d||1),recLastDayV1011(p.y,p.m));
  }
  if(type==='yearly'){
    const months=(c.months||[]).map(Number);
    if(!months.includes(p.m))return false;
    if(c.monthEnd)return p.d===recLastDayV1011(p.y,p.m);
    return p.d===Math.min(Number(c.day||1),recLastDayV1011(p.y,p.m));
  }
  return false;
}
function conditionsMatchV1011(conds,logic,ds){
  const list=(conds||[]).filter(Boolean);
  if(!list.length)return false;
  return String(logic||'OR').toUpperCase()==='AND'
    ? list.every(c=>condMatchV1011(c,ds))
    : list.some(c=>condMatchV1011(c,ds));
}
function condSummaryV1011(c){
  const wn=['日','一','二','三','四','五','六'];
  if(c.type==='daily')return '每天';
  if(c.type==='weekly')return '每周'+(c.weekdays||[]).map(x=>'周'+wn[Number(x)]).join('、');
  if(c.type==='monthend')return '每月最后一天';
  if(c.type==='monthly')return c.monthEnd?'每月最后一天':`每月${c.day||1}日`;
  if(c.type==='quarterly')return `每3个月${c.monthEnd?'月末':(c.day||1)+'日'}`;
  if(c.type==='yearly')return `每年${(c.months||[]).join('、')}月${c.monthEnd?'月末':(c.day||1)+'日'}`;
  return '';
}

function recConditionRowV1011(c={}){
  const type=c.type||'weekly', w=(c.weekdays||[5]).map(Number), months=(c.months||[4,8]).map(Number);
  return `<div class="rec-rule-v1011">
    <div class="rec-rule-head-v1011">
      <select class="recType" onchange="refreshRecRowV1011(this)">
        <option value="daily" ${type==='daily'?'selected':''}>每天</option>
        <option value="weekly" ${type==='weekly'?'selected':''}>每周指定星期</option>
        <option value="monthly" ${type==='monthly'?'selected':''}>每月指定日期</option>
        <option value="monthend" ${type==='monthend'?'selected':''}>每月最后一天</option>
        <option value="quarterly" ${type==='quarterly'?'selected':''}>每3个月</option>
        <option value="yearly" ${type==='yearly'?'selected':''}>每年指定月份</option>
      </select>
      <button type="button" class="rec-remove-v1011" onclick="this.closest('.rec-rule-v1011').remove()">✕</button>
    </div>
    <div class="recWeekly rec-detail-v1011" style="${type==='weekly'?'':'display:none'}">
      <div class="rec-weekdays-v1011">
        ${['日','一','二','三','四','五','六'].map((n,i)=>`<label><input type="checkbox" class="recWeek" value="${i}" ${w.includes(i)?'checked':''}>周${n}</label>`).join('')}
      </div>
    </div>
    <div class="recDay rec-detail-v1011" style="${['monthly','quarterly','yearly'].includes(type)?'':'display:none'}">
      <label>执行日 <input type="number" class="recDayInput" min="1" max="31" value="${Number(c.day||1)}"></label>
      <label><input type="checkbox" class="recMonthEnd" ${c.monthEnd?'checked':''}> 使用该月最后一天</label>
    </div>
    <div class="recQuarter rec-detail-v1011" style="${type==='quarterly'?'':'display:none'}">
      <label>起算日期 <input type="date" class="recAnchor" value="${esc(c.anchorDate||todayISO())}"></label>
    </div>
    <div class="recYear rec-detail-v1011" style="${type==='yearly'?'':'display:none'}">
      <div class="rec-months-v1011">
        ${Array.from({length:12},(_,i)=>i+1).map(m=>`<label><input type="checkbox" class="recMonth" value="${m}" ${months.includes(m)?'checked':''}>${m}月</label>`).join('')}
      </div>
    </div>
  </div>`;
}
function refreshRecRowV1011(sel){
  const row=sel.closest('.rec-rule-v1011'),t=sel.value;
  row.querySelectorAll('.rec-detail-v1011').forEach(x=>x.style.display='none');
  if(t==='weekly')row.querySelector('.recWeekly').style.display='';
  if(['monthly','quarterly','yearly'].includes(t))row.querySelector('.recDay').style.display='';
  if(t==='quarterly')row.querySelector('.recQuarter').style.display='';
  if(t==='yearly')row.querySelector('.recYear').style.display='';
}
function addRecRuleV1011(boxId){
  const box=document.getElementById(boxId);if(box)box.insertAdjacentHTML('beforeend',recConditionRowV1011({type:'weekly',weekdays:[5]}));
}
function collectRecRulesV1011(boxId){
  const box=document.getElementById(boxId);if(!box)return[];
  return [...box.querySelectorAll('.rec-rule-v1011')].map(row=>{
    const type=row.querySelector('.recType').value,c={type};
    if(type==='weekly')c.weekdays=[...row.querySelectorAll('.recWeek:checked')].map(x=>Number(x.value));
    if(['monthly','quarterly','yearly'].includes(type)){
      c.day=Number(row.querySelector('.recDayInput')?.value||1);
      c.monthEnd=!!row.querySelector('.recMonthEnd')?.checked;
    }
    if(type==='quarterly')c.anchorDate=row.querySelector('.recAnchor')?.value||todayISO();
    if(type==='yearly')c.months=[...row.querySelectorAll('.recMonth:checked')].map(x=>Number(x.value));
    return c;
  }).filter(c=>c.type!=='weekly'||c.weekdays.length).filter(c=>c.type!=='yearly'||c.months.length);
}

/* ----- Routine ----- */
function isRoutineDue(r,dateStr){
  const conditions=r.recConditionsV1011?.length?r.recConditionsV1011:[legacyRoutineConditionV1011(r)];
  return conditionsMatchV1011(conditions,r.recLogicV1011||'OR',dateStr);
}
function repeatText(r){
  const conditions=r.recConditionsV1011?.length?r.recConditionsV1011:[legacyRoutineConditionV1011(r)];
  return conditions.map(condSummaryV1011).join((r.recLogicV1011||'OR')==='AND'?' AND ':' OR ');
}
function openRoutineModal(id){
  const r=state.routines.find(x=>x.id===id)||{name:'',repeat:'weekdays',weekdays:[1,2,3,4,5],subtasks:[],tags:[],icon:'●'};
  const conditions=r.recConditionsV1011?.length?r.recConditionsV1011:[legacyRoutineConditionV1011(r)];
  modal(`<h2>${id?'编辑':'新建'} Routine</h2>
    <div class="form-row"><div class="form-field"><label>名称</label><input id="rName" value="${esc(r.name)}"></div><div class="form-field"><label>图标</label><input id="rIcon" value="${esc(r.icon||'●')}" maxlength="4"></div></div>
    <div class="form-field"><label>标签</label><input id="rTags" value="${esc((r.tags||[]).join(', '))}"></div>
    <div class="form-field"><label>多个条件之间</label><select id="rRecLogic">
      <option value="OR" ${(r.recLogicV1011||'OR')==='OR'?'selected':''}>OR / 或：任意条件满足即可</option>
      <option value="AND" ${r.recLogicV1011==='AND'?'selected':''}>AND / 且：所有条件同时满足</option>
    </select><div class="item-meta">例：每周五 OR 每月最后一天</div></div>
    <div id="rRecRules">${conditions.map(recConditionRowV1011).join('')}</div>
    <button class="small-btn" type="button" onclick="addRecRuleV1011('rRecRules')">＋ 添加重复条件</button>
    <h3>子任务</h3><div id="rSubs">${(r.subtasks||[]).map(routineSubEditRow).join('')}</div>
    <button class="small-btn" onclick="$('#rSubs').insertAdjacentHTML('beforeend',routineSubEditRow({id:uid(),title:''}))">＋子任务</button>
    <div class="modal-actions"><button class="ghost-btn" onclick="closeModal()">取消</button><button class="primary-btn" onclick="saveRoutineV1011('${id||''}')">保存</button></div>`);
}
async function saveRoutineV1011(id){
  const rules=collectRecRulesV1011('rRecRules');
  if(!rules.length){toast('请至少设置一个有效的重复条件');return}
  const old=id?state.routines.find(x=>x.id===id):null;
  const x={...(old||{}),id:id||uid(),name:$('#rName').value.trim(),icon:$('#rIcon').value.trim()||'●',tags:splitTags($('#rTags').value),
    recLogicV1011:$('#rRecLogic').value,recConditionsV1011:rules,
    subtasks:$$('.rsub').map(e=>({id:e.dataset.id,title:e.querySelector('.rsub-title').value.trim()})).filter(x=>x.title)};
  if(id)state.routines[state.routines.findIndex(v=>v.id===id)]=x;else state.routines.push(x);
  await saveState();closeModal();renderAll();
}

/* ----- Kanban recurring ----- */
function recurrenceDue(rule,d=new Date()){
  const ds=recISOFromDateV1011(d);
  const conditions=rule.recConditionsV1011?.length?rule.recConditionsV1011:[legacyKanbanConditionV1011(rule)];
  return conditionsMatchV1011(conditions,rule.recLogicV1011||'OR',ds);
}
function recurrenceKey(rule,d=new Date()){
  /* one generation per actual matched calendar day; this is required when one rule has Tue + Fri */
  return recISOFromDateV1011(d);
}
function openRepeatModal(id){
  const t=state.kanban.find(x=>x.id===id);if(!t)return;
  const r=(state.kanbanRecurring||[]).find(x=>x.sourceCardId===id)||{targetColumnId:t.status,enabled:true};
  const conditions=r.recConditionsV1011?.length?r.recConditionsV1011:[legacyKanbanConditionV1011(r)];
  modal(`<h2>🔁 定期重复</h2>
    <div class="form-field"><label>多个条件之间</label><select id="repLogicV1011">
      <option value="OR" ${(r.recLogicV1011||'OR')==='OR'?'selected':''}>OR / 或：任意条件满足即可</option>
      <option value="AND" ${r.recLogicV1011==='AND'?'selected':''}>AND / 且：所有条件同时满足</option>
    </select><div class="item-meta">每周二和周五：只需在同一个“每周指定星期”条件里同时勾周二、周五。</div></div>
    <div id="repRulesV1011">${conditions.map(recConditionRowV1011).join('')}</div>
    <button class="small-btn" type="button" onclick="addRecRuleV1011('repRulesV1011')">＋ 添加重复条件</button>
    <div class="form-field" style="margin-top:12px"><label>自动生成到哪一列</label><select id="repCol">${state.kanbanColumns.map(c=>`<option value="${c.id}" ${r.targetColumnId===c.id?'selected':''}>${esc(c.name)}</option>`).join('')}</select></div>
    <label class="checkbox-line"><input id="repEnabled" type="checkbox" ${r.enabled!==false?'checked':''}>启用</label>
    <div class="modal-actions"><button class="ghost-btn" onclick="closeModal()">取消</button><button class="primary-btn" onclick="saveRepeatRuleV1011('${id}')">保存</button></div>`);
}
async function saveRepeatRuleV1011(id){
  const t=state.kanban.find(x=>x.id===id);if(!t)return;
  const rules=collectRecRulesV1011('repRulesV1011');
  if(!rules.length){toast('请至少设置一个有效的重复条件');return}
  state.kanbanRecurring??=[];
  let r=state.kanbanRecurring.find(x=>x.sourceCardId===id);
  if(!r){r={id:uid(),sourceCardId:id};state.kanbanRecurring.push(r)}
  Object.assign(r,{name:t.title,recLogicV1011:$('#repLogicV1011').value,recConditionsV1011:rules,targetColumnId:$('#repCol').value,enabled:$('#repEnabled').checked,snapshot:recurringSnapshotFromCard(t)});
  ensureRecurringKanban();await saveState();closeModal();renderKanban();toast('定期重复已保存');
}

/* preserve new routine recurrence in templates without breaking old templates */
function cloneRoutineSnapshot(r){
  return {name:r.name,icon:r.icon||'●',tags:[...(r.tags||[])],repeat:r.repeat,weekdays:[...(r.weekdays||[])],
    recLogicV1011:r.recLogicV1011||'OR',recConditionsV1011:structuredClone(r.recConditionsV1011||[]),
    subtasks:(r.subtasks||[]).map(s=>({id:uid(),title:s.title}))};
}
/* ======================= END V10.11 ======================= */


/* ======================= V10.12 TEMPLATE HOTFIX ======================= */
/* Fix 1: restore direct "从模板" button on Kanban page.
   Fix 2: avoid duplicated inline tasks when saving/editing Kanban templates. */

function stripInlineTasksFromHtmlV1012(html){
  const box=document.createElement('div');
  box.innerHTML=html||'';
  box.querySelectorAll('.inline-task').forEach(el=>el.remove());
  /* remove wrappers that became truly empty after task removal */
  [...box.querySelectorAll('div,p')].reverse().forEach(el=>{
    if(!el.textContent.trim() && !el.querySelector('img,br,a')) el.remove();
  });
  return box.innerHTML;
}

/* Normalize both newly saved and already-existing templates. */
async function saveKanbanTemplate(id){
  const t=state.kanban.find(x=>x.id===id);if(!t)return;
  const name=prompt('模板名称',t.title);if(!name)return;
  const checks=clearTaskTimes(t.checks||[]);
  state.kanbanTemplates.push({
    id:uid(),name,title:t.title,
    html:stripInlineTasksFromHtmlV1012(t.html||''),
    tags:[...(t.tags||[])],checks,
    plannedStartAt:'',dueAt:'',createdAt:Date.now()
  });
  await saveState();toast('已保存为模板');
}

function editKanbanTemplate(id){
  const t=state.kanbanTemplates.find(x=>x.id===id);if(!t)return;
  /* Old templates can already contain task HTML + task data with different IDs.
     Strip task HTML first, then render exactly one canonical task tree. */
  const cleanHtml=stripInlineTasksFromHtmlV1012(t.html||'');
  modal(`<h2>编辑 Kanban 模板</h2>
    <div class="form-row"><input id="ktName" value="${esc(t.name)}" placeholder="模板名称"><input id="ktTitle" value="${esc(t.title||'')}" placeholder="卡片标题"></div>
    <input id="ktTags" value="${esc((t.tags||[]).join(', '))}" placeholder="标签">
    ${richEditor('ktRich',mergeTasksIntoHtml(cleanHtml,t.checks||[]),'模板 Memo / 子任务…')}
    <div class="modal-actions"><button class="ghost-btn" onclick="closeModal()">取消</button><button class="primary-btn" onclick="saveKanbanTemplateEdit('${id}')">保存</button></div>`);
  setTimeout(()=>{ try{hydrateAllRichEditors()}catch(e){} },0);
}

async function saveKanbanTemplateEdit(id){
  const t=state.kanbanTemplates.find(x=>x.id===id);if(!t)return;
  t.name=$('#ktName').value.trim();
  t.title=$('#ktTitle').value.trim();
  t.tags=splitTags($('#ktTags').value);
  t.checks=clearTaskTimes(collectInlineTasks('ktRich'));
  t.html=stripInlineTasksFromHtmlV1012($('#ktRich').innerHTML);
  await saveState();closeModal();renderTemplates();
}

async function applyKanbanTemplate(id){
  const x=state.kanbanTemplates.find(t=>t.id===id);if(!x)return;
  const checks=clearTaskTimes(x.checks||[]);
  const t={id:uid(),title:x.title,status:state.kanbanColumns[0]?.id||'todo',
    html:stripInlineTasksFromHtmlV1012(x.html||''),tags:[...(x.tags||[])],checks,images:[],
    startedAt:null,completedAt:null,plannedStartAt:'',dueAt:'',showMemo:false,archived:false,createdAt:Date.now()};
  t.html=mergeTasksIntoHtml(t.html,t.checks);
  state.kanban.push(t);await saveState();closeModal();goPage('kanban');setTimeout(()=>openKanbanCard(t.id),0);
}

/* Last-definition-wins override, based on V10.11's stable renderer. */
function renderKanban(){
  ensureRecurringKanban();
  const cols=state.kanbanColumns, archivedCount=state.kanban.filter(x=>x.archived).length;
  $('#page-kanban').innerHTML=`<div class="section-title"><h2>Kanban</h2><div>
    <button class="ghost-btn" onclick="createFromKanbanTemplate()">📋 从模板</button>
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
/* ======================= END V10.12 TEMPLATE HOTFIX ======================= */
