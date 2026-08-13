
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
 executions:[]
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
 state.projects??=[]; state.projectCategories??=structuredClone(DEFAULT.projectCategories); state.kanbanColumns??=structuredClone(DEFAULT.kanbanColumns);
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
  <button type="button" onclick="richCmd('${id}','insertUnorderedList')">• List</button>
  <button type="button" onclick="richCmd('${id}','indent')">→ 缩进</button>
  <button type="button" onclick="richCmd('${id}','outdent')">← 回缩</button>
  <input type="color" title="字体颜色" onchange="richColor('${id}',this.value)"/>
  <button type="button" onclick="richLink('${id}')">🔗 Link</button>
 </div>`;
}
function richEditor(id,html,placeholder='输入内容…'){return `${richToolbar(id)}<div id="${id}" class="rich-editor" contenteditable="true" data-placeholder="${esc(placeholder)}">${html||''}</div>`}
function richCmd(id,cmd){document.getElementById(id)?.focus();document.execCommand(cmd,false,null)}
function richColor(id,c){document.getElementById(id)?.focus();document.execCommand('foreColor',false,c)}
function richLink(id){const u=prompt('输入链接 URL');if(!u)return;document.getElementById(id)?.focus();document.execCommand('createLink',false,u)}
function wireImageDrop(zoneId,editorId,callback){
 const z=document.getElementById(zoneId),ed=document.getElementById(editorId); if(!z||!ed)return;
 z.ondragover=e=>e.preventDefault(); z.ondrop=e=>{e.preventDefault();filesToData([...e.dataTransfer.files],callback)};
 ed.onpaste=e=>{const fs=[...e.clipboardData.items].filter(i=>i.type.startsWith('image/')).map(i=>i.getAsFile());if(fs.length){e.preventDefault();filesToData(fs,callback)}};
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
 $('#page-today').innerHTML=`<div class="grid grid-3"><div class="card"><div class="kpi">${done}/${rs.length}</div><div class="kpi-label">今日 Routine</div></div><div class="card"><div class="kpi">${activeP}</div><div class="kpi-label">长期任务 / Projects</div></div><div class="card"><div class="kpi">${state.kanban.filter(x=>x.status!=='done').length}</div><div class="kpi-label">Kanban 未完成</div></div></div>
 <div class="grid grid-2" style="margin-top:18px"><div class="card"><div class="section-title"><h2>今日 Routine</h2><button class="small-btn" onclick="goPage('routine')">历史</button></div>${rs.map(r=>routineItem(r,d)).join('')}</div>
 <div class="card"><div class="section-title"><h2>长期任务</h2><button class="small-btn" onclick="goPage('projects')">全部</button></div>${state.projects.filter(p=>p.status!=='done').slice(0,6).map(p=>`<div class="item project-row" onclick="openProject('${p.id}')"><div class="item-title">${esc(p.title)}</div><div class="tags">${tagHtml(p.tags)}</div></div>`).join('')||'<div class="empty">还没有长期任务</div>'}</div></div>`
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
function projectSummary(p){return `<div class="item project-row" onclick="openProject('${p.id}')"><div class="item-row"><div><div class="item-title">${esc(p.title)}</div><div class="item-meta">${p.startAt||'-'} → ${p.endAt||'进行中'} · ${esc(p.status||'doing')}</div><div class="tags">${tagHtml(p.tags)}</div></div><span>›</span></div></div>`}
function openCategoryModal(id){
 const c=state.projectCategories.find(x=>x.id===id)||{name:''};modal(`<h2>${id?'编辑':'新建'}分类</h2><input id="catName" value="${esc(c.name)}"><div class="modal-actions"><button class="ghost-btn" onclick="closeModal()">取消</button><button class="primary-btn" onclick="saveCategory('${id||''}')">保存</button></div>`)
}
async function saveCategory(id){const n=$('#catName').value.trim();if(!n)return;if(id)state.projectCategories.find(x=>x.id===id).name=n;else state.projectCategories.push({id:uid(),name:n});await saveState();closeModal();renderProjects()}
function openProjectCreate(){
 modal(`<h2>新建长期任务</h2><div class="form-field"><label>标题</label><input id="pTitle"></div><div class="form-field"><label>分类</label><select id="pCat"><option value="">未分类</option>${state.projectCategories.map(c=>`<option value="${c.id}">${esc(c.name)}</option>`).join('')}</select></div>
 <div class="modal-actions"><button class="ghost-btn" onclick="closeModal()">取消</button><button class="primary-btn" onclick="createProject()">创建</button></div>`)
}
async function createProject(){
 const p={id:uid(),title:$('#pTitle').value.trim(),categoryId:$('#pCat').value,status:'doing',tags:[],startAt:'',endAt:'',html:'',subtasks:[],handoffs:[],reports:[],questions:[],investigations:[],images:[],createdAt:Date.now()};
 if(!p.title)return;state.projects.unshift(p);await saveState();closeModal();renderProjects();openProject(p.id)
}
function openProject(id){
 const p=state.projects.find(x=>x.id===id);if(!p)return;
 drawer(`<div class="drawer-head"><div><h2 style="margin:0">${esc(p.title)}</h2><div class="tags">${tagHtml(p.tags)}</div></div><button class="ghost-btn" onclick="closeDrawer()">✕</button></div>
 <div class="form-row" style="margin-top:14px"><div class="form-field"><label>标题</label><input id="pdTitle" value="${esc(p.title)}"></div><div class="form-field"><label>分类</label><select id="pdCat"><option value="">未分类</option>${state.projectCategories.map(c=>`<option value="${c.id}" ${p.categoryId===c.id?'selected':''}>${esc(c.name)}</option>`).join('')}</select></div></div>
 <div class="form-row"><div class="form-field"><label>主任务开始日期时间</label><input type="datetime-local" id="pdStart" value="${esc(p.startAt||'')}"></div><div class="form-field"><label>主任务结束日期时间</label><input type="datetime-local" id="pdEnd" value="${esc(p.endAt||'')}"></div></div>
 <div class="form-row"><div class="form-field"><label>状态</label><select id="pdStatus"><option value="todo" ${p.status==='todo'?'selected':''}>TODO</option><option value="doing" ${p.status==='doing'?'selected':''}>DOING</option><option value="waiting" ${p.status==='waiting'?'selected':''}>WAITING</option><option value="done" ${p.status==='done'?'selected':''}>DONE</option></select></div><div class="form-field"><label>标签（逗号分隔）</label><input id="pdTags" value="${esc((p.tags||[]).join(', '))}"></div></div>
 <h3>项目 Memo</h3>${richEditor('projectRich',p.html,'记录背景、处理思路、内部说明…')}
 <div id="projectDrop" class="drop-zone">Ctrl+V 粘贴截图，或拖图片到这里</div>${imageGrid(p.images,'project',p.id)}
 <h3>子任务</h3><div id="projectSubs">${(p.subtasks||[]).map(projectSubRow).join('')}</div><button class="small-btn" onclick="addProjectSub('${p.id}')">＋ 子任务</button>
 ${noteSection('交接 / 对接人员','handoffs',p)}
 ${noteSection('汇报记录','reports',p)}
 ${noteSection('被提出的问题','questions',p)}
 ${noteSection('需要调查的地方','investigations',p)}
 <div class="modal-actions"><button class="danger-btn" onclick="deleteProject('${p.id}')">删除项目</button><button class="primary-btn" onclick="saveProjectDrawer('${p.id}')">保存</button></div>`);
 wireImageDrop('projectDrop','projectRich',async im=>{p.images.push(im);await saveState();openProject(p.id)})
}
function projectSubRow(s){return `<div class="item psub" data-id="${s.id}"><input class="ps-title" value="${esc(s.title)}"><div class="form-row" style="margin-top:8px"><input type="datetime-local" class="ps-start" value="${esc(s.startAt||'')}"><input type="datetime-local" class="ps-end" value="${esc(s.endAt||'')}"></div><textarea class="ps-note" placeholder="子任务 Memo">${esc(s.note||'')}</textarea><button class="danger-btn" onclick="this.closest('.psub').remove()">删除</button></div>`}
function addProjectSub(){const html=projectSubRow({id:uid(),title:'',startAt:'',endAt:'',note:''});$('#projectSubs').insertAdjacentHTML('beforeend',html)}
function noteSection(title,key,p){return `<h3>${title}</h3><div id="${key}List">${(p[key]||[]).map(n=>`<div class="timeline-note nrow" data-id="${n.id}"><div class="form-row"><input class="n-date" type="datetime-local" value="${esc(n.date||'')}"><input class="n-who" placeholder="人员 / 对象" value="${esc(n.who||'')}"></div><textarea class="n-text">${esc(n.text||'')}</textarea><button class="danger-btn" onclick="this.parentElement.remove()">删除</button></div>`).join('')}</div><button class="small-btn" onclick="addNoteRow('${key}List')">＋ 添加记录</button>`}
function addNoteRow(id){document.getElementById(id).insertAdjacentHTML('beforeend',`<div class="timeline-note nrow" data-id="${uid()}"><div class="form-row"><input class="n-date" type="datetime-local"><input class="n-who" placeholder="人员 / 对象"></div><textarea class="n-text"></textarea><button class="danger-btn" onclick="this.parentElement.remove()">删除</button></div>`)}
function collectNotes(id){return [...document.querySelectorAll(`#${id} .nrow`)].map(e=>({id:e.dataset.id,date:e.querySelector('.n-date').value,who:e.querySelector('.n-who').value.trim(),text:e.querySelector('.n-text').value.trim()})).filter(x=>x.date||x.who||x.text)}
async function saveProjectDrawer(id){
 const p=state.projects.find(x=>x.id===id);Object.assign(p,{title:$('#pdTitle').value.trim(),categoryId:$('#pdCat').value,startAt:$('#pdStart').value,endAt:$('#pdEnd').value,status:$('#pdStatus').value,tags:splitTags($('#pdTags').value),html:$('#projectRich').innerHTML,
 subtasks:$$('.psub').map(e=>({id:e.dataset.id,title:e.querySelector('.ps-title').value.trim(),startAt:e.querySelector('.ps-start').value,endAt:e.querySelector('.ps-end').value,note:e.querySelector('.ps-note').value.trim()})).filter(x=>x.title),
 handoffs:collectNotes('handoffsList'),reports:collectNotes('reportsList'),questions:collectNotes('questionsList'),investigations:collectNotes('investigationsList')});
 await saveState();closeDrawer();renderProjects();toast('项目已保存')
}
async function deleteProject(id){if(!confirm('删除这个项目？'))return;state.projects=state.projects.filter(x=>x.id!==id);await saveState();closeDrawer();renderProjects()}

let kanbanFilter='';
function renderKanban(){
 const cols=state.kanbanColumns;
 $('#page-kanban').innerHTML=`<div class="section-title"><h2>Kanban</h2><div><button class="ghost-btn" onclick="addKanbanColumn()">＋ 新列</button> <button class="primary-btn" onclick="openKanbanCard()">＋ 新建卡片</button></div></div>
 <div class="filterbar"><input placeholder="按标题 / 标签筛选" value="${esc(kanbanFilter)}" oninput="kanbanFilter=this.value;renderKanban()"></div>
 <div class="kanban">${cols.map(c=>`<div class="kanban-col" ondragover="event.preventDefault()" ondrop="dropTask(event,'${c.id}')"><div class="item-row"><h3>${esc(c.name)}</h3><button class="small-btn" onclick="renameKanbanColumn('${c.id}')">⋯</button></div>
 ${state.kanban.filter(x=>x.status===c.id).filter(k=>!kanbanFilter||k.title.toLowerCase().includes(kanbanFilter.toLowerCase())||(k.tags||[]).some(t=>t.toLowerCase().includes(kanbanFilter.toLowerCase()))).map(cardHtml).join('')}</div>`).join('')}</div>`
}
function cardHtml(t){return `<div class="task-card" draggable="true" ondragstart="event.dataTransfer.setData('text/plain','${t.id}')" onclick="openKanbanCard('${t.id}')"><div class="item-title">${esc(t.title)}</div><div class="tags">${tagHtml(t.tags)}</div><div class="item-meta">${(t.checks||[]).filter(x=>x.done).length}/${(t.checks||[]).length} 子任务 · ${(t.images||[]).length} 图片</div></div>`}
function addKanbanColumn(){const n=prompt('新列名称，例如 REVIEW / BLOCKED');if(!n)return;state.kanbanColumns.push({id:uid(),name:n});saveState().then(renderKanban)}
function renameKanbanColumn(id){const c=state.kanbanColumns.find(x=>x.id===id),n=prompt('列名称',c.name);if(!n)return;c.name=n;saveState().then(renderKanban)}
async function dropTask(ev,status){const t=state.kanban.find(x=>x.id===ev.dataTransfer.getData('text/plain'));if(t){t.status=status;await saveState();renderKanban()}}
function openKanbanCard(id){
 const t=state.kanban.find(x=>x.id===id)||{id:'',title:'',status:state.kanbanColumns[0]?.id||'todo',html:'',checks:[],images:[],tags:[]};
 drawer(`<div class="drawer-head"><h2>${id?'Kanban 卡片':'新建 Kanban 卡片'}</h2><button class="ghost-btn" onclick="closeDrawer()">✕</button></div>
 <div class="form-field"><label>标题</label><input id="kcTitle" value="${esc(t.title)}"></div><div class="form-row"><div class="form-field"><label>状态</label><select id="kcStatus">${state.kanbanColumns.map(c=>`<option value="${c.id}" ${t.status===c.id?'selected':''}>${esc(c.name)}</option>`).join('')}</select></div><div class="form-field"><label>标签</label><input id="kcTags" value="${esc((t.tags||[]).join(', '))}"></div></div>
 <h3>Memo</h3>${richEditor('kanbanRich',t.html,'支持粗体、下划线、颜色、缩进、链接…')}
 <h3>Checkbox / 子任务</h3><div id="kcChecks">${(t.checks||[]).map(checkRow).join('')}</div><button class="small-btn" onclick="addCheckRow('kcChecks')">＋ Checkbox</button>
 <div id="kanbanDrop" class="drop-zone">Ctrl+V 粘贴截图，或拖图片到这里</div>${imageGrid(t.images,'kanban',t.id)}
 <div class="modal-actions">${id?`<button class="danger-btn" onclick="deleteKanban('${t.id}')">删除</button>`:''}<button class="primary-btn" onclick="saveKanbanDrawer('${t.id}')">保存</button></div>`);
 wireImageDrop('kanbanDrop','kanbanRich',async im=>{t.images.push(im); if(id){await saveState();openKanbanCard(id)} else {window.__newKanbanImages=(window.__newKanbanImages||[]).concat(im);toast('图片已暂存，保存卡片后生效')}})
}
function checkRow(c){return `<div class="item check-row" data-id="${c.id}"><label class="checkbox-line"><input type="checkbox" class="c-done" ${c.done?'checked':''}><input class="c-text" value="${esc(c.text)}"></label></div>`}
function addCheckRow(id){document.getElementById(id).insertAdjacentHTML('beforeend',checkRow({id:uid(),text:'',done:false}))}
function collectChecks(sel){return $$(sel+' .check-row').map(e=>({id:e.dataset.id,text:e.querySelector('.c-text').value.trim(),done:e.querySelector('.c-done').checked})).filter(x=>x.text)}
async function saveKanbanDrawer(id){
 let t=id?state.kanban.find(x=>x.id===id):{id:uid(),images:window.__newKanbanImages||[]};Object.assign(t,{title:$('#kcTitle').value.trim(),status:$('#kcStatus').value,tags:splitTags($('#kcTags').value),html:$('#kanbanRich').innerHTML,checks:collectChecks('#kcChecks')});
 if(!id)state.kanban.push(t);window.__newKanbanImages=[];await saveState();closeDrawer();renderKanban()
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
