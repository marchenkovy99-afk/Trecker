/* Linear-inspired legal workspace. Uses existing task/case records and cloud bridge. */
(()=>{
'use strict';
const templates=[
  {id:'contract',label:'Проверка договора',hint:'Анализ условий, рисков и правок',title:'Проверить договор',extra:'Проверить существенные условия, риски и согласовать редакцию.',nextStep:'Запросить актуальную редакцию договора',priority:'normal'},
  {id:'opinion',label:'Юридическое заключение',hint:'Подготовка письменной позиции',title:'Подготовить юридическое заключение',extra:'Определить правовой вопрос, изучить нормы и практику, сформулировать вывод и риски.',nextStep:'Собрать обстоятельства и документы',priority:'high'},
  {id:'regulator',label:'Ответ на запрос',hint:'Регулятор, подразделение или клиент',title:'Подготовить ответ на запрос',extra:'Проверить основание запроса, сроки, полномочия и необходимые согласования.',nextStep:'Уточнить перечень документов',priority:'high'},
  {id:'followup',label:'Ожидание позиции',hint:'Запросить решение и назначить проверку',title:'Получить позицию подразделения',extra:'Зафиксировать запрошенные сведения и ожидаемый результат.',nextStep:'Направить напоминание адресату',priority:'normal',status:'waiting'}
];
const LABELS={new:'К выполнению',inwork:'В работе',waiting:'Ожидание',done:'Завершено'};
const FILTERS={all:'Все задачи',today:'Сегодня',urgent:'Срочные',waiting:'Ожидание',done:'Завершенные'};
const TRACKED=new Set([LS.tasks,LS.projectTasks,LS.projects,LS.notes,LS.calendarEvents]);
const historyKey='lawyerChangeHistoryV1';
const groupOpen={new:true,inwork:true,waiting:true,done:false};
let activeFilter='all',search='',pending=null,undoStack=[],history=[],muted=false,undoBusy=false;
try{history=JSON.parse(sessionStorage.getItem(historyKey)||'[]');if(!Array.isArray(history))history=[]}catch{history=[]}
const glyph=(name)=>'<svg class="icon" aria-hidden="true"><use href="#i-'+name+'"></use></svg>';
const day=()=>{const d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')};
const date=value=>value?new Date(value+'T12:00:00').toLocaleDateString('ru-RU',{day:'numeric',month:'short'}):'';
const attrs=id=>String(id??'');
const related=()=>[...load(LS.tasks).filter(valid).map(t=>({task:normTask(t),key:LS.tasks})),...load(LS.projectTasks).filter(valid).map(t=>({task:normTask(t),key:LS.projectTasks}))];
const notify=msg=>{const el=document.getElementById('linToast');if(!el)return;el.textContent=msg;el.classList.add('show');clearTimeout(el._timer);el._timer=setTimeout(()=>el.classList.remove('show'),3500)};
function recordable(key,before,after){
  if(!TRACKED.has(key)||before===after||((before||'').length+(after||'').length)>550000)return false;
  if(key===LS.projects){
    try{
      const beforeList=JSON.parse(before||'[]'),afterList=JSON.parse(after||'[]');
      if(beforeList.length===afterList.length&&beforeList.every(p=>{
        const q=afterList.find(item=>String(item.id)===String(p.id));
        if(!q)return false;
        const a={...p},b={...q};delete a.draftHtml;delete b.draftHtml;delete a.updatedAt;delete b.updatedAt;
        return JSON.stringify(a)===JSON.stringify(b);
      }))return false;
    }catch{}
  }
  return true;
}
function flushHistory(){
  const group=pending;pending=null;if(!group||!group.changes.size)return;
  const changes=[...group.changes.values()];
  const risky=changes.some(c=>{
    if(c.key!==LS.projects)return false;
    try{const old=JSON.parse(c.before||'[]'),current=JSON.parse(c.after||'[]');return old.some(p=>!current.some(q=>String(q.id)===String(p.id))&&(p.attachments||[]).length>0)}catch{return true}
  });
  group.undoable=!risky;
  group.summary=changes.map(c=>c.key===LS.tasks?'задач':c.key===LS.projectTasks?'задач по делам':c.key===LS.projects?'дел':c.key===LS.notes?'заметок':'событий').filter((s,i,a)=>a.indexOf(s)===i).join(', ');
  history.unshift({when:group.when,summary:group.summary,undoable:group.undoable});history=history.slice(0,35);
  try{sessionStorage.setItem(historyKey,JSON.stringify(history))}catch{}
  undoStack.push(group);if(undoStack.length>12)undoStack.shift();
}
const originalSave=save;
save=function linTrackedSave(key,value){
  const before=localStorage.getItem(key);
  const result=originalSave(key,value);
  if(result!==false&&!muted&&recordable(key,before,localStorage.getItem(key))){
    const after=localStorage.getItem(key);
    if(!pending){pending={when:new Date().toISOString(),changes:new Map(),undoable:true};setTimeout(flushHistory,0)}
    if(!pending.changes.has(key))pending.changes.set(key,{key,before,after});
    else pending.changes.get(key).after=after;
  }
  return result;
};
globalThis.save=save;
function undoLast(){
  flushHistory();
  const group=undoStack.at(-1);
  if(!group){notify('Нет изменений, доступных для отмены');return;}
  if(!group.undoable){notify('В этом действии удалены вложения: отмена недоступна');return;}
  if(group.changes.size>5){notify('Слишком много изменений для безопасной отмены');return;}
  if([...group.changes.values()].some(change=>localStorage.getItem(change.key)!==change.after)){
    notify('Данные изменились после действия. Отмена заблокирована во избежание потери изменений.');return;
  }
  undoBusy=true;muted=true;
  try{
    for(const change of group.changes.values()){
      const old=change.before===null?[]:JSON.parse(change.before);
      if(originalSave(change.key,old)===false){notify('Недостаточно места для отмены');return;}
    }
    undoStack.pop();
    history.unshift({when:new Date().toISOString(),summary:'Отмена изменения',undoable:false});
    history=history.slice(0,35);
    try{sessionStorage.setItem(historyKey,JSON.stringify(history))}catch{}
    render();notify('Последнее изменение отменено');
  }catch{notify('Не удалось отменить действие')}
  finally{muted=false;undoBusy=false}
}
function iconStatus(status){
  return status==='done'?glyph('check'):status==='waiting'?glyph('calendar'):status==='inwork'?glyph('check-square'):glyph('inbox');
}
function meta(task){
  const result=[];
  if(task.actionDate)result.push('Сделать '+date(task.actionDate));
  if(task.dueDate)result.push('Срок '+date(task.dueDate));
  if(task.status==='waiting'&&task.waitingFor)result.push('Ждём: '+task.waitingFor);
  if(task.status==='waiting'&&task.waitingReminderAt)result.push((task.waitingReminderAt<=day()?'Проверить сейчас':'Проверить '+date(task.waitingReminderAt)));
  return result;
}
function taskItem(entry){
  const t=entry.task,pr=t.projectId?allProjects().find(p=>String(p.id)===String(t.projectId)):null;
  const reminder=t.status==='waiting'&&t.waitingReminderAt&&t.waitingReminderAt<=day();
  const late=overdue(t),id=esc(attrs(t.id)),isCase=Boolean(t.projectId),done=t.status==='done';
  const info=meta(t);
  const toggle=isCase?('data-ref-toggle-task="'+id+'" data-key="'+esc(entry.key)+'"'):done?('data-restore-task="'+id+'"'):('data-done-task="'+id+'"');
  const edit=isCase?('data-ref-task="'+id+'" data-key="'+esc(entry.key)+'"'):('data-edit-task="'+id+'"');
  return '<article class="lin-row workspace-task-row'+(done?' is-done':'')+'" data-lin-row data-sort-id="'+id+'">'+
    '<button class="lin-tick '+(done?'checked':'')+'" type="button" '+toggle+' aria-label="'+(done?'Вернуть в работу':'Завершить')+' задачу '+esc(t.title)+'">'+(done?glyph('check'):'')+'</button>'+
    '<button class="lin-row-body" type="button" '+edit+'><span class="lin-title">'+esc(t.title)+'</span>'+
    (t.nextStep?'<span class="lin-next">'+esc(t.nextStep)+'</span>':'')+
    '<span class="lin-meta">'+(pr?'<span class="lin-project">'+esc(pr.title)+'</span>':'')+info.map(str=>'<span class="'+(str.startsWith('Проверить сейчас')||late&&str.startsWith('Срок')?'is-alert':'')+'">'+esc(str)+'</span>').join('')+'</span></button>'+
    '<div class="workspace-row-actions lin-row-actions">'+(!done&&!isCase?'<button class="lin-small-action" type="button" data-set-priority="'+id+'" data-task-scope="root" aria-label="Приоритет для задачи '+esc(t.title)+'">'+glyph('flag')+'</button>':'')+
    (!isCase?'<button class="lin-small-action" type="button" data-edit-task="'+id+'" aria-label="Открыть задачу '+esc(t.title)+'">'+glyph('arrow-right')+'</button>':'')+
    (done&&!isCase?'<button class="lin-small-action lin-restore" type="button" data-restore-task="'+id+'">Вернуть</button>':'')+
    '<span class="lin-state '+t.status+'">'+iconStatus(t.status)+'</span>'+(reminder?'<span class="lin-alert-dot" title="Время проверить ожидание"></span>':'')+'</div></article>';
}

const groups=[['inwork','В работе'],['waiting','В ожидании'],['new','К выполнению'],['done','Завершено']];
function filterBy(entry){
  const t=entry.task;
  if(search&&!([t.title,t.extra,t.nextStep,t.waitingFor,t.notes].some(x=>String(x||'').toLocaleLowerCase('ru').includes(search.toLocaleLowerCase('ru')))))return false;
  if(activeFilter==='waiting')return t.status==='waiting';
  if(activeFilter==='done')return t.status==='done';
  if(activeFilter==='urgent')return t.status!=='done'&&(t.priority==='high'||overdue(t)||t.status==='waiting'&&t.waitingReminderAt&&t.waitingReminderAt<=day());
  if(activeFilter==='today')return t.status!=='done'&&(t.actionDate===day()||t.dueDate===day()||t.status==='waiting'&&t.waitingReminderAt&&t.waitingReminderAt<=day());
  return true;
}
function order(a,b){
  const at=a.task,bt=b.task;
  const rank=t=>overdue(t)?0:t.status==='waiting'&&t.waitingReminderAt&&t.waitingReminderAt<=day()?1:t.priority==='high'?2:3;
  return rank(at)-rank(bt)||(at.actionDate||at.dueDate||'9999').localeCompare(bt.actionDate||bt.dueDate||'9999')||String(bt.createdAt||'').localeCompare(String(at.createdAt||''));
}
function renderTasksLinear(){
  const list=related().filter(filterBy);
  const active=related().filter(x=>x.task.status!=='done').length;
  const sections=groups.map(([status,label])=>{
    const tasks=list.filter(x=>x.task.status===status).sort(order);
    const expanded=activeFilter==='all'?(status==='done'?Boolean(state.showCompleted):groupOpen[status]):true;
    return '<section class="lin-group" data-status="'+status+'"><button type="button" class="lin-group-heading" data-lin-collapse="'+status+'" aria-expanded="'+expanded+'"><span class="lin-expand">'+(expanded?'⌄':'›')+'</span><span class="lin-group-icon '+status+'">'+iconStatus(status)+'</span><strong>'+label+'</strong><span class="lin-count">'+tasks.length+'</span></button>'+
      '<div class="lin-group-entries" '+(expanded?'':'hidden')+'>'+(tasks.map(taskItem).join('')||(expanded?'<div class="lin-empty">В этой группе пока нет задач</div>':''))+'</div></section>';
  });
  page.innerHTML='<div class="lin-workspace"><header class="lin-heading"><div><p class="lin-crumb">Рабочее пространство / Задачи</p><h2>Активные задачи <span>'+active+'</span></h2></div><div class="lin-toolbar"><button type="button" class="lin-tool" data-lin-history>'+glyph('calendar')+' История</button><button type="button" class="lin-tool" data-lin-templates>'+glyph('note')+' Шаблоны</button><button type="button" class="lin-primary" data-ref-new-task>'+glyph('plus')+' Новая задача</button></div></header>'+
    '<div class="lin-listbar"><div class="lin-filters">'+Object.entries(FILTERS).map(([key,label])=>'<button type="button" data-lin-filter="'+key+'" class="'+(key===activeFilter?'active':'')+'">'+esc(label)+'</button>').join('')+'</div><label class="lin-search">'+glyph('search')+'<input id="linSearch" type="search" value="'+esc(search)+'" placeholder="Поиск по задачам" aria-label="Поиск по задачам"></label></div>'+
    '<div class="lin-groups"><div id="activeTasks">'+sections.slice(0,3).join('')+'</div><div id="completedTasks">'+sections[3]+'</div></div>'+
    '<div class="lin-bottom"><button type="button" data-lin-native-backup>Экспорт и резервная копия</button><span>Сроки и ожидания сохраняются в существующих задачах</span></div></div>';
  const searchEl=document.getElementById('linSearch');if(searchEl)searchEl.addEventListener('input',()=>{const cursor=searchEl.selectionStart;search=searchEl.value;renderTasksLinear();const next=document.getElementById('linSearch');next?.focus();next?.setSelectionRange(cursor,cursor)});
}
function enhanceCase(){
  const project=allProjects().find(p=>String(p.id)===String(state.projectId));
  const target=page.querySelector('.ref-case-headline');if(!project||!target)return;
  const bar=document.createElement('div');bar.className='lin-case-nextstep';
  bar.innerHTML='<span class="lin-next-mark">'+glyph('flag')+'</span><span><small>Следующий шаг по делу</small><strong>'+esc(project.nextStep||'Не определён. Добавьте конкретное действие.')+'</strong></span><button type="button" data-ref-edit-case="'+esc(attrs(project.id))+'">Изменить</button>';
  target.insertAdjacentElement('afterend',bar);
}
function addSidebar(){
  const tabs=document.getElementById('tabs');if(!tabs||document.querySelector('.lin-side-filters'))return;
  const menu=document.createElement('div');menu.className='lin-side-filters';
  menu.innerHTML='<p>Вид задач</p>'+[['all','Все задачи'],['today','Сегодня'],['waiting','Ожидание'],['urgent','Срочные']].map(([key,label])=>'<button type="button" data-lin-filter="'+key+'">'+(key==='waiting'?glyph('calendar'):key==='urgent'?glyph('flag'):glyph('tasks'))+'<span>'+label+'</span></button>').join('')+'<div class="lin-side-divider"></div><button type="button" data-lin-templates>'+glyph('note')+'<span>Шаблоны</span></button><button type="button" data-lin-history>'+glyph('calendar')+'<span>История</span></button>';
  tabs.after(menu);
}
function syncSidebar(){
  document.querySelectorAll('.lin-side-filters [data-lin-filter]').forEach(el=>el.classList.toggle('active',state.tab==='tasks'&&el.dataset.linFilter===activeFilter));
}
const oldRender=render;
render=function linearRender(){oldRender();addSidebar();syncSidebar();if(state.projectId)enhanceCase();else if(state.tab==='tasks')renderTasksLinear();};
globalThis.render=render;
function templateDialog(){
  if(document.getElementById('linTemplateDialog'))return;
  const element=document.createElement('section');element.className='overlay lin-dialog';element.id='linTemplateDialog';element.setAttribute('role','dialog');element.setAttribute('aria-modal','true');element.setAttribute('aria-labelledby','linTemplateTitle');element.setAttribute('aria-hidden','true');
  element.innerHTML='<div class="sheet"><div class="lin-dialog-title"><div><span class="lin-eyebrow">Библиотека шаблонов</span><h2 id="linTemplateTitle">Новая задача из шаблона</h2></div><button type="button" data-lin-close-templates aria-label="Закрыть">✕</button></div><p class="lin-dialog-subtitle">Выберите сценарий. Текст и сроки можно изменить до сохранения.</p><div class="lin-template-list">'+templates.map(t=>'<button type="button" data-lin-preset="'+t.id+'"><span class="lin-template-icon">'+glyph('note')+'</span><span><strong>'+esc(t.label)+'</strong><small>'+esc(t.hint)+'</small></span>'+glyph('arrow-right')+'</button>').join('')+'</div></div>';
  document.body.appendChild(element);
}
function historyDialog(){
  if(document.getElementById('linHistoryDialog'))return;
  const element=document.createElement('section');element.className='overlay lin-dialog';element.id='linHistoryDialog';element.setAttribute('role','dialog');element.setAttribute('aria-modal','true');element.setAttribute('aria-labelledby','linHistoryTitle');element.setAttribute('aria-hidden','true');
  element.innerHTML='<div class="sheet"><div class="lin-dialog-title"><div><span class="lin-eyebrow">Текущая сессия</span><h2 id="linHistoryTitle">История изменений</h2></div><button type="button" data-lin-close-history aria-label="Закрыть">✕</button></div><p class="lin-dialog-subtitle">Отмена доступна для последнего изменения, если записи не были изменены позднее. Вложения и внешние изменения не восстанавливаются.</p><div id="linHistoryList"></div><div class="lin-history-actions"><button class="lin-primary" type="button" data-lin-undo>↶ Отменить последнее изменение</button></div></div>';
  document.body.appendChild(element);
}
function showHistory(){
  flushHistory();historyDialog();
  document.getElementById('linHistoryList').innerHTML=history.length?history.slice(0,20).map(item=>'<div class="lin-history-entry"><span>'+glyph('check-square')+'</span><div><strong>'+esc(item.summary||'Изменение')+'</strong><small>'+esc(new Date(item.when).toLocaleString('ru-RU'))+'</small></div></div>').join(''):'<div class="lin-empty">В этой сессии изменений пока нет</div>';
  showOverlay(document.getElementById('linHistoryDialog'));
}
function showTemplates(){templateDialog();showOverlay(document.getElementById('linTemplateDialog'))}
const toast=document.createElement('div');toast.id='linToast';toast.className='lin-toast';toast.setAttribute('role','status');toast.setAttribute('aria-live','polite');document.body.appendChild(toast);
document.addEventListener('click',event=>{
  const button=event.target.closest('[data-lin-filter],[data-lin-collapse],[data-lin-templates],[data-lin-close-templates],[data-lin-preset],[data-lin-history],[data-lin-close-history],[data-lin-undo],[data-lin-native-backup]');
  if(!button)return;event.preventDefault();event.stopPropagation();
  if(button.hasAttribute('data-lin-filter')){activeFilter=button.dataset.linFilter;search='';state.query='';if(state.tab!=='tasks'||state.projectId)switchTab('tasks');else render();return;}
  if(button.hasAttribute('data-lin-collapse')){const k=button.dataset.linCollapse;groupOpen[k]=!groupOpen[k];renderTasksLinear();return;}
  if(button.hasAttribute('data-lin-templates')){showTemplates();return;}
  if(button.hasAttribute('data-lin-close-templates')){hideOverlay(document.getElementById('linTemplateDialog'));return;}
  if(button.hasAttribute('data-lin-preset')){const t=templates.find(t=>t.id===button.dataset.linPreset);if(!t)return;hideOverlay(document.getElementById('linTemplateDialog'));openTask({title:t.title,extra:t.extra,nextStep:t.nextStep,priority:t.priority,status:t.status||'new'});return;}
  if(button.hasAttribute('data-lin-history')){showHistory();return;}
  if(button.hasAttribute('data-lin-close-history')){hideOverlay(document.getElementById('linHistoryDialog'));return;}
  if(button.hasAttribute('data-lin-undo')){hideOverlay(document.getElementById('linHistoryDialog'));undoLast();return;}
  if(button.hasAttribute('data-lin-native-backup')){const f=document.getElementById('backupBtn');if(!f){const old=oldRender;old();}document.getElementById('backupBtn')?.click();return;}
},true);
document.addEventListener('keydown',event=>{if(event.key==='Escape'){for(const name of ['linTemplateDialog','linHistoryDialog']){const el=document.getElementById(name);if(el?.classList.contains('show')){event.stopImmediatePropagation();hideOverlay(el);return;}}}});
render();
})();
