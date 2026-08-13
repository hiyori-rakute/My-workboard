
const $ = s=>document.querySelector(s);
const $$ = s=>[...document.querySelectorAll(s)];
const uid = ()=>crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36)+Math.random().toString(36).slice(2);
const todayISO = ()=>new Date().toISOString().slice(0,10);
const fmtDate = d=>new Intl.DateTimeFormat('zh-CN',{year:'numeric',month:'long',day:'numeric',weekday:'short'}).format(new Date(d+'T12:00:00'));
const fmtTime = ts=>ts ? new Intl.DateTimeFormat('zh-CN',{hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false}).format(new Date(ts)) : '-';
const esc = s=>(s??'').toString().replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
const msToText = ms=>{
  if(!ms || ms<0) return '-';
  const sec=Math.floor(ms/1000), h=Math.floor(sec/3600), m=Math.floor((sec%3600)/60), s=sec%60;
  return [h?`${h}h`:null,m?`${m}m`:null,`${s}s`].filter(Boolean).join(' ');
};

const DEFAULT_DATA = {
  routines:[
    {id:uid(),name:'Mail Check',repeat:'weekdays',weekdays:[1,2,3,4,5],createdAt:Date.now()},
    {id:uid(),name:'JP1 Check',repeat:'weekdays',weekdays:[1,2,3,4,5],createdAt:Date.now()},
    {id:uid(),name:'IDMC Check',repeat:'weekdays',weekdays:[1,2,3,4,5],createdAt:Date.now()}
  ],
  routineLogs:{},
  sopTemplates:[
    {
      id:uid(),name:'Database Refresh',category:'Database',description:'月次 Database Refresh 作业模板',
      links:[],
      steps:[
        {id:uid(),title:'事前确认',note:'确认作业窗口、对象环境、相关联系人。'},
        {id:uid(),title:'DB Backup',note:''},
        {id:uid(),title:'Stop Application',note:''},
        {id:uid(),title:'Refresh',note:''},
        {id:uid(),title:'Start Application',note:''},
        {id:uid(),title:'事后确认',note:''}
      ]
    }
  ],
  executions:[],
  kanban:[
    {id:uid(),title:'确认 AMO 回复',status:'todo',note:''},
    {id:uid(),title:'更新手顺书',status:'doing',note:''}
  ],
  memos:[
    {id:uid(),title:'Quick Memo',content:'可以在这里记录临时 Memo、链接和截图。',checks:[],images:[],updatedAt:Date.now()}
  ]
};
let state;

async function loadState(){
  await openDB();
  state = await dbGet('state');
  if(!state){ state=structuredClone(DEFAULT_DATA); await saveState(); }
  // migrations / missing keys
  for(const [k,v] of Object.entries(DEFAULT_DATA)) if(state[k]===undefined) state[k]=structuredClone(v);
}
async function saveState(){ await dbSet('state',state); }
function toast(msg){
  const el=document.createElement('div'); el.className='toast'; el.textContent=msg; $('#toastRoot').appendChild(el);
  setTimeout(()=>el.remove(),2200);
}
function modal(html){
  $('#modalRoot').innerHTML=`<div class="modal-backdrop"><div class="modal">${html}</div></div>`;
}
function closeModal(){ $('#modalRoot').innerHTML=''; }

function isRoutineDue(r,dateStr){
  const d=new Date(dateStr+'T12:00:00'), wd=d.getDay();
  if(r.repeat==='daily') return true;
  if(r.repeat==='weekdays') return wd>=1&&wd<=5;
  if(r.repeat==='custom') return (r.weekdays||[]).includes(wd);
  return true;
}
function getRoutineLog(date,id){ return state.routineLogs?.[date]?.[id] || null; }
async function setRoutineStatus(date,id,status){
  state.routineLogs[date] ||= {};
  if(!status) delete state.routineLogs[date][id];
  else state.routineLogs[date][id]={status,completedAt:status==='done'?Date.now():null};
  await saveState(); renderAll();
}

function routineItemHtml(r,date){
  const log=getRoutineLog(date,r.id);
  const st=log?.status||'';
  return `<div class="item">
    <div class="item-row">
      <div>
        <div class="item-title">${esc(r.name)}</div>
        <div class="item-meta">${log?.completedAt ? '完成 '+fmtTime(log.completedAt) : '未记录'}</div>
      </div>
      <div class="status-group">
        <button class="status-btn done ${st==='done'?'active':''}" onclick="setRoutineStatus('${date}','${r.id}','done')">✅ 完成</button>
        <button class="status-btn leave ${st==='leave'?'active':''}" onclick="setRoutineStatus('${date}','${r.id}','leave')">🏖 休假</button>
        <button class="status-btn na ${st==='na'?'active':''}" onclick="setRoutineStatus('${date}','${r.id}','na')">➖ 不适用</button>
        <button class="status-btn miss ${st==='miss'?'active':''}" onclick="setRoutineStatus('${date}','${r.id}','miss')">✕ 未完成</button>
        <button class="status-btn" onclick="setRoutineStatus('${date}','${r.id}','')">↺</button>
      </div>
    </div>
  </div>`;
}

function renderToday(){
  const date=todayISO(), routines=state.routines.filter(r=>isRoutineDue(r,date));
  const done=routines.filter(r=>getRoutineLog(date,r.id)?.status==='done').length;
  const activeExec=state.executions.find(e=>!e.completedAt);
  $('#page-today').innerHTML=`
    <div class="grid grid-3">
      <div class="card"><div class="kpi">${done}/${routines.length}</div><div class="kpi-label">今日 Routine 完成</div></div>
      <div class="card"><div class="kpi">${state.kanban.filter(x=>x.status!=='done').length}</div><div class="kpi-label">未完成 Kanban</div></div>
      <div class="card"><div class="kpi">${state.executions.length}</div><div class="kpi-label">SOP 执行历史</div></div>
    </div>
    <div class="grid grid-2" style="margin-top:18px">
      <div class="card">
        <div class="section-title"><h2>🔁 今日 Routine</h2><button class="small-btn" onclick="goPage('routine')">查看历史</button></div>
        <div class="progress"><div style="width:${routines.length?done/routines.length*100:0}%"></div></div>
        <div class="list" style="margin-top:14px">${routines.map(r=>routineItemHtml(r,date)).join('')||'<div class="empty">今天没有 Routine</div>'}</div>
      </div>
      <div class="card">
        <div class="section-title"><h2>📚 Running SOP</h2><button class="small-btn" onclick="goPage('sop')">SOP</button></div>
        ${activeExec ? renderExecutionCompact(activeExec) : '<div class="empty">当前没有执行中的 SOP</div>'}
      </div>
    </div>
    <div class="card" style="margin-top:18px">
      <div class="section-title"><h2>📊 Today's Work</h2><button class="small-btn" onclick="goPage('kanban')">打开看板</button></div>
      <div class="list">${state.kanban.filter(x=>x.status!=='done').slice(0,6).map(x=>`<div class="item"><div class="item-title">${esc(x.title)}</div><div class="item-meta">${x.status==='todo'?'TODO':'DOING'}</div></div>`).join('')||'<div class="empty">没有待办</div>'}</div>
    </div>`;
}

let routineViewDate=todayISO();
function renderRoutine(){
  const date=routineViewDate;
  const due=state.routines.filter(r=>isRoutineDue(r,date));
  $('#page-routine').innerHTML=`
    <div class="card">
      <div class="section-title">
        <h2>Daily Routine</h2>
        <div><button class="ghost-btn" onclick="routineViewDate=todayISO();renderRoutine()">今天</button>
        <button class="primary-btn" onclick="openRoutineModal()">＋ 新建 Routine</button></div>
      </div>
      <div class="form-row">
        <div class="form-field"><label>查看日期</label><input type="date" value="${date}" onchange="routineViewDate=this.value;renderRoutine()"/></div>
        <div class="form-field"><label>日期</label><div class="item">${fmtDate(date)}</div></div>
      </div>
      <div class="list" style="margin-top:16px">${due.map(r=>routineItemHtml(r,date)).join('')||'<div class="empty">这一天没有 Routine</div>'}</div>
    </div>
    <div class="card" style="margin-top:18px">
      <div class="section-title"><h2>历史月历</h2><span class="muted">✅完成　🏖休假　➖不适用　✕未完成</span></div>
      ${renderRoutineCalendar(date)}
    </div>
    <div class="card" style="margin-top:18px">
      <div class="section-title"><h2>Routine 管理</h2></div>
      <div class="list">${state.routines.map(r=>`
        <div class="item"><div class="item-row"><div><div class="item-title">${esc(r.name)}</div><div class="item-meta">${repeatText(r)}</div></div>
        <div><button class="small-btn" onclick="openRoutineModal('${r.id}')">编辑</button> <button class="danger-btn" onclick="deleteRoutine('${r.id}')">删除</button></div></div></div>`).join('')}</div>
    </div>`;
}
function repeatText(r){
  if(r.repeat==='daily') return '每天';
  if(r.repeat==='weekdays') return '工作日';
  const names=['日','一','二','三','四','五','六'];
  return '每周 '+(r.weekdays||[]).map(x=>'周'+names[x]).join('、');
}
function renderRoutineCalendar(dateStr){
  const d=new Date(dateStr+'T12:00:00'), y=d.getFullYear(), m=d.getMonth();
  const first=new Date(y,m,1), last=new Date(y,m+1,0), start=first.getDay();
  let cells=['日','一','二','三','四','五','六'].map(x=>`<div class="muted" style="text-align:center">${x}</div>`);
  for(let i=0;i<start;i++) cells.push('<div></div>');
  for(let day=1;day<=last.getDate();day++){
    const ds=`${y}-${String(m+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
    const icons=[];
    state.routines.filter(r=>isRoutineDue(r,ds)).forEach(r=>{
      const st=getRoutineLog(ds,r.id)?.status;
      if(st==='done') icons.push('✅'); else if(st==='leave') icons.push('🏖'); else if(st==='na') icons.push('➖'); else if(st==='miss') icons.push('✕');
    });
    cells.push(`<div class="day ${ds===todayISO()?'today':''}" onclick="routineViewDate='${ds}';renderRoutine()"><div class="num">${day}</div><div class="day-events">${icons.slice(0,8).map(i=>`<span class="dot">${i}</span>`).join('')}</div></div>`);
  }
  return `<div class="calendar">${cells.join('')}</div>`;
}
function openRoutineModal(id){
  const r=state.routines.find(x=>x.id===id)||{name:'',repeat:'weekdays',weekdays:[1,2,3,4,5]};
  modal(`<h2>${id?'编辑':'新建'} Routine</h2>
    <div class="form-field"><label>名称</label><input id="rName" value="${esc(r.name)}"/></div>
    <div class="form-field" style="margin-top:10px"><label>重复</label>
      <select id="rRepeat"><option value="daily" ${r.repeat==='daily'?'selected':''}>每天</option><option value="weekdays" ${r.repeat==='weekdays'?'selected':''}>工作日</option><option value="custom" ${r.repeat==='custom'?'selected':''}>指定星期</option></select>
    </div>
    <div style="margin-top:10px">${['日','一','二','三','四','五','六'].map((n,i)=>`<label class="checkbox-line"><input type="checkbox" class="rWeek" value="${i}" ${(r.weekdays||[]).includes(i)?'checked':''}/> 周${n}</label>`).join('')}</div>
    <div class="modal-actions"><button class="ghost-btn" onclick="closeModal()">取消</button><button class="primary-btn" onclick="saveRoutineModal('${id||''}')">保存</button></div>`);
}
async function saveRoutineModal(id){
  const item={id:id||uid(),name:$('#rName').value.trim(),repeat:$('#rRepeat').value,weekdays:$$('.rWeek:checked').map(x=>+x.value),createdAt:Date.now()};
  if(!item.name) return toast('请输入名称');
  if(id) state.routines[state.routines.findIndex(x=>x.id===id)]={...state.routines.find(x=>x.id===id),...item}; else state.routines.push(item);
  await saveState(); closeModal(); renderAll();
}
async function deleteRoutine(id){
  if(!confirm('删除这个 Routine？历史记录会保留在备份里，但页面不再显示。')) return;
  state.routines=state.routines.filter(x=>x.id!==id); await saveState(); renderAll();
}

function renderSOP(){
  $('#page-sop').innerHTML=`
    <div class="section-title"><h2>SOP Templates</h2><button class="primary-btn" onclick="openSopTemplateModal()">＋ 新建 SOP</button></div>
    <div class="grid grid-2">${state.sopTemplates.map(t=>`
      <div class="card">
        <div class="item-row"><div><span class="pill">${esc(t.category||'General')}</span><h2 style="margin:8px 0 4px">${esc(t.name)}</h2><div class="muted">${esc(t.description||'')}</div></div></div>
        <div style="margin:14px 0">${t.steps.map((s,i)=>`<div class="item-meta">${i+1}. ${esc(s.title)}</div>`).join('')}</div>
        <div style="display:flex;gap:8px;flex-wrap:wrap"><button class="primary-btn" onclick="startSop('${t.id}')">▶ 开始作业</button><button class="ghost-btn" onclick="openSopTemplateModal('${t.id}')">编辑模板</button><button class="danger-btn" onclick="deleteSop('${t.id}')">删除</button></div>
      </div>`).join('')||'<div class="card empty">还没有 SOP 模板</div>'}
    </div>`;
}
function openSopTemplateModal(id){
  const t=state.sopTemplates.find(x=>x.id===id)||{name:'',category:'',description:'',links:[],steps:[{id:uid(),title:'',note:''}]};
  modal(`<h2>${id?'编辑':'新建'} SOP Template</h2>
    <div class="form-row"><div class="form-field"><label>名称</label><input id="sopName" value="${esc(t.name)}"/></div><div class="form-field"><label>分类</label><input id="sopCat" value="${esc(t.category)}"/></div></div>
    <div class="form-field" style="margin-top:10px"><label>说明</label><textarea id="sopDesc">${esc(t.description)}</textarea></div>
    <div class="form-field" style="margin-top:10px"><label>参考链接（每行一个）</label><textarea id="sopLinks">${(t.links||[]).join('\n')}</textarea></div>
    <h3>步骤</h3><div id="stepEditor">${t.steps.map((s,i)=>stepEditRow(s,i)).join('')}</div>
    <button class="small-btn" onclick="addStepEditor()">＋ 添加步骤</button>
    <div class="modal-actions"><button class="ghost-btn" onclick="closeModal()">取消</button><button class="primary-btn" onclick="saveSopTemplate('${id||''}')">保存模板</button></div>`);
}
function stepEditRow(s,i){return `<div class="item step-edit" data-id="${s.id||uid()}" style="margin-bottom:8px">
  <div class="form-field"><label>步骤 ${i+1}</label><input class="step-title" value="${esc(s.title)}"/></div>
  <div class="form-field" style="margin-top:6px"><label>备注 / 命令 / 注意事项</label><textarea class="step-note">${esc(s.note||'')}</textarea></div>
  <button class="danger-btn" onclick="this.closest('.step-edit').remove()">删除步骤</button></div>`}
function addStepEditor(){ $('#stepEditor').insertAdjacentHTML('beforeend',stepEditRow({id:uid(),title:'',note:''},$$('.step-edit').length)); }
async function saveSopTemplate(id){
  const item={id:id||uid(),name:$('#sopName').value.trim(),category:$('#sopCat').value.trim(),description:$('#sopDesc').value.trim(),
    links:$('#sopLinks').value.split('\n').map(x=>x.trim()).filter(Boolean),
    steps:$$('.step-edit').map(el=>({id:el.dataset.id,title:el.querySelector('.step-title').value.trim(),note:el.querySelector('.step-note').value.trim()})).filter(s=>s.title)};
  if(!item.name) return toast('请输入 SOP 名称');
  if(id) state.sopTemplates[state.sopTemplates.findIndex(x=>x.id===id)]=item; else state.sopTemplates.push(item);
  await saveState(); closeModal(); renderAll();
}
async function deleteSop(id){ if(!confirm('删除这个 SOP 模板？历史执行记录不会删除。'))return; state.sopTemplates=state.sopTemplates.filter(x=>x.id!==id); await saveState(); renderAll(); }

function startSop(templateId){
  const t=state.sopTemplates.find(x=>x.id===templateId);
  modal(`<h2>开始作业：${esc(t.name)}</h2>
    <div class="form-field"><label>执行日期</label><input id="execDate" type="date" value="${todayISO()}"/></div>
    <div class="form-field" style="margin-top:10px"><label>环境 / 对象</label><input id="execEnv" placeholder="例如 SH2 / DEV / PRD"/></div>
    <div class="form-field" style="margin-top:10px"><label>备注</label><textarea id="execNote"></textarea></div>
    <div class="modal-actions"><button class="ghost-btn" onclick="closeModal()">取消</button><button class="primary-btn" onclick="createExecution('${templateId}')">▶ 创建执行记录</button></div>`);
}
async function createExecution(templateId){
  const t=state.sopTemplates.find(x=>x.id===templateId);
  const e={id:uid(),templateId,templateName:t.name,date:$('#execDate').value||todayISO(),environment:$('#execEnv').value.trim(),note:$('#execNote').value.trim(),
    createdAt:Date.now(),startedAt:Date.now(),completedAt:null,
    steps:t.steps.map(s=>({id:uid(),templateStepId:s.id,title:s.title,note:s.note||'',startedAt:null,completedAt:null,memo:'',images:[]}))};
  state.executions.unshift(e); await saveState(); closeModal(); renderAll(); openExecution(e.id);
}
function renderExecutionCompact(e){
  const done=e.steps.filter(s=>s.completedAt).length;
  return `<div><div class="item-title">${esc(e.templateName)}</div><div class="item-meta">${esc(e.date)} ${esc(e.environment||'')}</div>
  <div class="progress" style="margin:12px 0"><div style="width:${e.steps.length?done/e.steps.length*100:0}%"></div></div>
  <div class="item-meta">${done}/${e.steps.length} steps</div><button class="primary-btn" style="margin-top:12px" onclick="openExecution('${e.id}')">继续作业</button></div>`;
}
function openExecution(id){
  const e=state.executions.find(x=>x.id===id); if(!e)return;
  modal(`<h2>${esc(e.templateName)}</h2>
    <div class="muted">${esc(e.date)} ${e.environment?' · '+esc(e.environment):''}</div>
    ${e.note?`<pre class="codeish">${esc(e.note)}</pre>`:''}
    <div style="margin-top:16px">${e.steps.map((s,i)=>renderExecStep(e,s,i)).join('')}</div>
    <div class="modal-actions"><button class="ghost-btn" onclick="closeModal()">关闭</button>${!e.completedAt?`<button class="primary-btn" onclick="finishExecution('${e.id}')">完成整个作业</button>`:''}</div>`);
}
function renderExecStep(e,s,i){
  const cls=s.completedAt?'completed':s.startedAt?'running':'';
  const elapsed=s.completedAt&&s.startedAt?s.completedAt-s.startedAt:s.startedAt?Date.now()-s.startedAt:null;
  return `<div class="sop-step ${cls}">
    <div class="step-head">
      <div><div class="item-title">${i+1}. ${esc(s.title)}</div>${s.note?`<pre class="codeish">${esc(s.note)}</pre>`:''}
      <div class="item-meta">Start: ${fmtTime(s.startedAt)}　Done: ${fmtTime(s.completedAt)}　⏱ <span class="timer">${msToText(elapsed)}</span></div></div>
      <div class="step-actions">
        ${!s.startedAt?`<button class="small-btn" onclick="startStep('${e.id}','${s.id}')">▶ Start</button>`:''}
        ${s.startedAt&&!s.completedAt?`<button class="primary-btn" onclick="completeStep('${e.id}','${s.id}')">✅ Complete</button>`:''}
        ${s.completedAt?`<button class="small-btn" onclick="resetStep('${e.id}','${s.id}')">↺ Reset</button>`:''}
      </div>
    </div>
    <div class="form-field" style="margin-top:10px"><label>步骤 Memo</label><textarea onchange="saveStepMemo('${e.id}','${s.id}',this.value)">${esc(s.memo||'')}</textarea></div>
  </div>`;
}
async function startStep(eid,sid){const s=state.executions.find(e=>e.id===eid).steps.find(x=>x.id===sid); s.startedAt=Date.now(); await saveState(); openExecution(eid); renderAll();}
async function completeStep(eid,sid){const s=state.executions.find(e=>e.id===eid).steps.find(x=>x.id===sid); if(!s.startedAt)s.startedAt=Date.now(); s.completedAt=Date.now(); await saveState(); openExecution(eid); renderAll();}
async function resetStep(eid,sid){const s=state.executions.find(e=>e.id===eid).steps.find(x=>x.id===sid); s.startedAt=null;s.completedAt=null; await saveState(); openExecution(eid); renderAll();}
async function saveStepMemo(eid,sid,val){const s=state.executions.find(e=>e.id===eid).steps.find(x=>x.id===sid); s.memo=val; await saveState();}
async function finishExecution(eid){const e=state.executions.find(x=>x.id===eid); e.completedAt=Date.now(); await saveState(); closeModal(); renderAll(); toast('执行记录已完成并保存');}

function renderHistory(){
  $('#page-history').innerHTML=`<div class="card"><div class="section-title"><h2>SOP Execution History</h2></div>
    <table class="history-table"><thead><tr><th>日期</th><th>SOP</th><th>环境</th><th>状态</th><th>总耗时</th><th></th></tr></thead><tbody>
    ${state.executions.map(e=>{
      const starts=e.steps.map(s=>s.startedAt).filter(Boolean), ends=e.steps.map(s=>s.completedAt).filter(Boolean);
      const dur=starts.length&&ends.length?Math.max(...ends)-Math.min(...starts):null;
      return `<tr><td>${esc(e.date)}</td><td>${esc(e.templateName)}</td><td>${esc(e.environment||'-')}</td><td>${e.completedAt?'✅ 完成':'🟡 进行中'}</td><td>${msToText(dur)}</td><td><button class="small-btn" onclick="openExecution('${e.id}')">查看</button> <button class="danger-btn" onclick="deleteExecution('${e.id}')">删除</button></td></tr>`;
    }).join('')||'<tr><td colspan="6" class="empty">还没有执行记录</td></tr>'}</tbody></table></div>`;
}
async function deleteExecution(id){if(!confirm('删除这条执行历史？'))return;state.executions=state.executions.filter(x=>x.id!==id);await saveState();renderAll();}

function renderKanban(){
  const cols=[['todo','TODO'],['doing','DOING'],['done','DONE']];
  $('#page-kanban').innerHTML=`<div class="section-title"><h2>Kanban</h2><button class="primary-btn" onclick="openTaskModal()">＋ 新建卡片</button></div>
    <div class="kanban">${cols.map(([key,label])=>`<div class="kanban-col" data-status="${key}" ondragover="event.preventDefault()" ondrop="dropTask(event,'${key}')"><h3>${label}</h3>
      ${state.kanban.filter(x=>x.status===key).map(t=>`<div class="task-card" draggable="true" ondragstart="event.dataTransfer.setData('text/plain','${t.id}')"><div class="item-title">${esc(t.title)}</div>${t.note?`<div class="item-meta">${esc(t.note)}</div>`:''}<div style="margin-top:10px"><button class="small-btn" onclick="openTaskModal('${t.id}')">编辑</button> <button class="danger-btn" onclick="deleteTask('${t.id}')">删除</button></div></div>`).join('')}
    </div>`).join('')}</div>`;
}
function openTaskModal(id){
  const t=state.kanban.find(x=>x.id===id)||{title:'',note:'',status:'todo'};
  modal(`<h2>${id?'编辑':'新建'} Kanban 卡片</h2><div class="form-field"><label>标题</label><input id="taskTitle" value="${esc(t.title)}"/></div>
  <div class="form-field" style="margin-top:10px"><label>Memo</label><textarea id="taskNote">${esc(t.note||'')}</textarea></div>
  <div class="form-field" style="margin-top:10px"><label>状态</label><select id="taskStatus"><option value="todo" ${t.status==='todo'?'selected':''}>TODO</option><option value="doing" ${t.status==='doing'?'selected':''}>DOING</option><option value="done" ${t.status==='done'?'selected':''}>DONE</option></select></div>
  <div class="modal-actions"><button class="ghost-btn" onclick="closeModal()">取消</button><button class="primary-btn" onclick="saveTask('${id||''}')">保存</button></div>`);
}
async function saveTask(id){const item={id:id||uid(),title:$('#taskTitle').value.trim(),note:$('#taskNote').value.trim(),status:$('#taskStatus').value};if(!item.title)return toast('请输入标题');if(id)state.kanban[state.kanban.findIndex(x=>x.id===id)]=item;else state.kanban.push(item);await saveState();closeModal();renderAll();}
async function deleteTask(id){state.kanban=state.kanban.filter(x=>x.id!==id);await saveState();renderAll();}
async function dropTask(ev,status){const id=ev.dataTransfer.getData('text/plain'),t=state.kanban.find(x=>x.id===id);if(t){t.status=status;await saveState();renderAll();}}

let activeMemoId=null;
function renderMemo(){
  if(!activeMemoId && state.memos[0]) activeMemoId=state.memos[0].id;
  const m=state.memos.find(x=>x.id===activeMemoId);
  $('#page-memo').innerHTML=`<div class="grid grid-2" style="grid-template-columns:280px 1fr">
    <div class="card"><div class="section-title"><h2>Memos</h2><button class="small-btn" onclick="newMemo()">＋</button></div>
      <div class="list">${state.memos.map(x=>`<button class="item" style="text-align:left" onclick="activeMemoId='${x.id}';renderMemo()"><div class="item-title">${esc(x.title)}</div><div class="item-meta">${new Date(x.updatedAt||Date.now()).toLocaleString()}</div></button>`).join('')}</div>
    </div>
    <div class="card">${m?memoEditorHtml(m):'<div class="empty">新建一个 Memo</div>'}</div>
  </div>`;
  if(m){
    const drop=$('#memoDrop');
    drop?.addEventListener('dragover',e=>{e.preventDefault();});
    drop?.addEventListener('drop',e=>{e.preventDefault();handleMemoFiles(m.id,e.dataTransfer.files);});
    $('#memoText')?.addEventListener('paste',e=>handlePaste(e,m.id));
  }
}
function memoEditorHtml(m){return `<div class="section-title"><input id="memoTitle" value="${esc(m.title)}" onchange="saveMemoField('${m.id}','title',this.value)"/><button class="danger-btn" onclick="deleteMemo('${m.id}')">删除</button></div>
  <textarea id="memoText" placeholder="输入 Memo。可直接 Ctrl+V 粘贴截图。" onchange="saveMemoField('${m.id}','content',this.value)">${esc(m.content||'')}</textarea>
  <div class="memo-toolbar"><button class="small-btn" onclick="addMemoCheckbox('${m.id}')">☑ 添加 Checkbox</button><button class="small-btn" onclick="addMemoLink('${m.id}')">🔗 添加链接</button></div>
  <div class="list">${(m.checks||[]).map(c=>`<label class="checkbox-line item"><input type="checkbox" ${c.done?'checked':''} onchange="toggleMemoCheck('${m.id}','${c.id}',this.checked)"/><span>${esc(c.text)}</span></label>`).join('')}</div>
  <div id="memoDrop" class="memo-drop">拖拽图片到这里，或在上面的 Memo 框里 Ctrl+V 粘贴截图</div>
  <div class="memo-images">${(m.images||[]).map(im=>`<div><img src="${im.data}" onclick="window.open(this.src)"/><button class="danger-btn" style="margin-top:5px" onclick="deleteMemoImage('${m.id}','${im.id}')">删除</button></div>`).join('')}</div>`}
async function newMemo(){const m={id:uid(),title:'New Memo',content:'',checks:[],images:[],updatedAt:Date.now()};state.memos.unshift(m);activeMemoId=m.id;await saveState();renderMemo();}
async function saveMemoField(id,key,val){const m=state.memos.find(x=>x.id===id);m[key]=val;m.updatedAt=Date.now();await saveState();}
async function addMemoCheckbox(id){const text=prompt('Checkbox 内容');if(!text)return;const m=state.memos.find(x=>x.id===id);m.checks.push({id:uid(),text,done:false});m.updatedAt=Date.now();await saveState();renderMemo();}
async function toggleMemoCheck(mid,cid,done){const c=state.memos.find(x=>x.id===mid).checks.find(x=>x.id===cid);c.done=done;await saveState();}
async function addMemoLink(id){const url=prompt('输入 URL'); if(!url)return; const m=state.memos.find(x=>x.id===id);m.content=(m.content||'')+`\n${url}`;m.updatedAt=Date.now();await saveState();renderMemo();}
async function deleteMemo(id){if(!confirm('删除这个 Memo？'))return;state.memos=state.memos.filter(x=>x.id!==id);activeMemoId=state.memos[0]?.id||null;await saveState();renderMemo();}
function handlePaste(e,mid){const items=[...e.clipboardData.items].filter(x=>x.type.startsWith('image/'));if(items.length){e.preventDefault();handleMemoFiles(mid,items.map(x=>x.getAsFile()));}}
function handleMemoFiles(mid,files){[...files].filter(f=>f&&f.type.startsWith('image/')).forEach(f=>{const reader=new FileReader();reader.onload=async()=>{const m=state.memos.find(x=>x.id===mid);m.images.push({id:uid(),name:f.name||'pasted-image',data:reader.result});m.updatedAt=Date.now();await saveState();renderMemo();};reader.readAsDataURL(f);});}
async function deleteMemoImage(mid,iid){const m=state.memos.find(x=>x.id===mid);m.images=m.images.filter(x=>x.id!==iid);await saveState();renderMemo();}

function renderSettings(){
  $('#page-settings').innerHTML=`<div class="grid grid-2">
    <div class="card"><h2>💾 Backup</h2><p class="muted">导出包含 Routine、SOP、历史、Kanban、Memo 和图片的数据文件。</p><button class="primary-btn" onclick="exportBackup()">导出 JSON 备份</button></div>
    <div class="card"><h2>📥 Restore</h2><p class="muted">导入之前导出的 JSON。当前数据会被覆盖。</p><input type="file" id="importFile" accept=".json"/><button class="ghost-btn" style="margin-top:10px" onclick="importBackup()">导入备份</button></div>
    <div class="card"><h2>🗃 Storage</h2><p class="muted">数据保存在当前浏览器的 IndexedDB。关闭浏览器不会自动清空，但清理网站数据、换电脑或换浏览器配置可能导致本机数据不可见。</p></div>
    <div class="card"><h2>⚠ Reset</h2><p class="muted">仅在确认已导出备份后使用。</p><button class="danger-btn" onclick="resetAll()">清空全部数据</button></div>
  </div>`;
}
function exportBackup(){
  const blob=new Blob([JSON.stringify({version:1,exportedAt:new Date().toISOString(),state},null,2)],{type:'application/json'});
  const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`my-workboard-backup-${todayISO()}.json`;a.click();URL.revokeObjectURL(a.href);toast('备份已导出');
}
async function importBackup(){
  const f=$('#importFile').files[0];if(!f)return toast('请选择 JSON 文件');
  try{const obj=JSON.parse(await f.text());if(!obj.state)throw new Error('invalid'); if(!confirm('导入会覆盖当前数据，继续？'))return;state=obj.state;await saveState();renderAll();toast('备份已恢复');}catch(e){toast('备份文件格式不正确');}
}
async function resetAll(){if(!confirm('确认清空全部数据？这个操作无法撤销。'))return;state=structuredClone(DEFAULT_DATA);await saveState();renderAll();toast('已恢复初始数据');}

function goPage(name){
  $$('.page').forEach(x=>x.classList.remove('active')); $(`#page-${name}`).classList.add('active');
  $$('.nav-item').forEach(x=>x.classList.toggle('active',x.dataset.page===name));
  $('#pageTitle').textContent=({today:'Today',routine:'Routine',sop:'SOP',history:'Execution History',kanban:'Kanban',memo:'Memo',settings:'Settings'})[name];
  if(name==='routine')renderRoutine(); if(name==='sop')renderSOP(); if(name==='history')renderHistory(); if(name==='kanban')renderKanban(); if(name==='memo')renderMemo(); if(name==='settings')renderSettings();
}
function renderAll(){
  $('#todayText').textContent=fmtDate(todayISO());
  renderToday();
  const active=$('.nav-item.active')?.dataset.page||'today';
  if(active!=='today') goPage(active);
}
document.addEventListener('DOMContentLoaded',async()=>{
  await loadState(); renderAll();
  $$('.nav-item').forEach(b=>b.addEventListener('click',()=>goPage(b.dataset.page)));
  $('#quickBackupBtn').addEventListener('click',exportBackup);
});
