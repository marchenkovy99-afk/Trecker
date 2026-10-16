/* Flow-inspired workspace enhancement. Original data, cases, attachments and sync stay authoritative. */
(()=>{
'use strict';
const icon=(name)=>'<svg class="icon" aria-hidden="true"><use href="#i-'+name+'"></use></svg>';
const todayKey=()=>{const d=new Date();return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-')};
let viewMode='list',commandSelection=null,inspected=null;
const entries=()=>[...load(LS.tasks).filter(valid).map(task=>({task:normTask(task),key:LS.tasks})),...load(LS.projectTasks).filter(valid).map(task=>({task:normTask(task),key:LS.projectTasks}))];
const projects=()=>allProjects().filter(valid);
const lookup=(id,key)=>{
 const found=entries().find(x=>String(x.task.id)===String(id)&&(!key||x.key===key));
 return found||null;
};
const formatDate=(v)=>v?new Date(v+'T12:00:00').toLocaleDateString('ru-RU',{day:'numeric',month:'short'}):'Без срока';
const priorityLabel=t=>t.priority==='high'?'Высокий':t.priority==='low'?'Низкий':t.priority==='medium'?'Средний':'Обычный';
const add=(tag,className,html)=>{const el=document.createElement(tag);el.className=className;el.innerHTML=html;return el};
function decorateNav(){
 const nav=document.getElementById('tabs');if(!nav)return;
 const labels={today:'Сегодня',tasks:'Задачи',projects:'Дела',priorities:'Приоритеты'};
 document.querySelectorAll('#tabs .tab').forEach(tab=>{
   const label=labels[tab.dataset.tab];if(!label)return;
   tab.title=label;tab.setAttribute('aria-label',label);
 });
 const brand=document.querySelector('.brandbar');
 if(brand&&!brand.querySelector('.flow-logo')){
   const monogram=add('span','flow-logo','Ю');monogram.setAttribute('aria-hidden','true');brand.prepend(monogram);
 }
}
function topbar(){
 const crumbs={today:['Рабочее пространство','Сегодня'],tasks:['Мои задачи','Управление задачами'],projects:['Дела','Юридические запросы'],priorities:['Планирование','Неделя приоритетов']};
 const pair=crumbs[state.projectId?'projects':state.tab]||crumbs.today;
 const old=page.querySelector('.flow-topbar');old?.remove();
 const el=add('header','flow-topbar','<div class="flow-breadcrumb"><span>'+esc(pair[0])+'</span><span class="flow-breadcrumb-arrow">›</span><strong>'+esc(state.projectId?'Работа по делу':pair[1])+'</strong></div>'+
   '<div class="flow-header-actions"><button type="button" class="flow-command-trigger" data-flow-command>'+icon('search')+' <span>Поиск задач и дел</span><kbd>Ctrl K</kbd></button>'+
   '<button class="flow-top-add" type="button" data-ref-new-task>'+icon('plus')+'<span>Новая задача</span></button></div>');
 page.prepend(el);
}
function dashboard(){
 const target=page.querySelector('.ref-today-body');if(!target||target.querySelector('.flow-dashboard'))return;
 const list=entries().filter(x=>x.task.status!=='done'),ts=list.map(x=>x.task);
 const today=todayKey();
 const inwork=ts.filter(t=>t.status==='inwork').length;
 const urgent=ts.filter(t=>overdue(t)||t.dueDate===today).length;
 const waiting=ts.filter(t=>t.status==='waiting').length;
 const cnt=projects().filter(p=>p.status!=='done').length;
 const stats=[
   ['В работе',inwork,'check-square'],
   ['Срок сегодня / просрочено',urgent,'calendar'],
   ['Ожидают ответа',waiting,'inbox'],
   ['Активные дела',cnt,'folder']
 ];
 const dateLabel=new Date().toLocaleDateString('ru-RU',{weekday:'long',day:'numeric',month:'long'});
 const header=add('section','flow-dashboard','<div class="flow-daily-intro"><div><span class="flow-eyebrow">МОЙ РАБОЧИЙ ДЕНЬ · '+esc(dateLabel)+'</span><h2>Хорошего рабочего дня</h2><p>Задачи, ближайшие сроки и дела в одном пространстве.</p></div><button type="button" class="flow-daily-add" data-ref-new-task>'+icon('plus')+' Новая задача</button></div><div class="flow-metrics">'+
   stats.map(([label,value,g])=>'<div class="flow-metric"><span class="flow-metric-icon">'+icon(g)+'</span><strong>'+value+'</strong><span>'+esc(label)+'</span></div>').join('')+'</div>');
 target.prepend(header);
 // The old empty waiting panel has already been removed by the existing UI layer.
 const focus=target.querySelector('.ref-panel-heading h3');if(focus&&focus.textContent.includes('Требует внимания'))focus.textContent='В фокусе';
}
function decorateTasks(){
 const workspace=page.querySelector('.lin-workspace');if(!workspace)return;
 workspace.classList.toggle('flow-board-view',viewMode==='board');
 const title=workspace.querySelector('.lin-heading h2');if(title&&!title.dataset.flowTitle){
   title.dataset.flowTitle='true';title.innerHTML='Список задач <span>'+entries().filter(x=>x.task.status!=='done').length+'</span>';
 }
 const nav=workspace.querySelector('.lin-listbar');
 if(nav&&!workspace.querySelector('.flow-view-select')){
   const bar=add('div','flow-view-select','<div class="flow-view-selector" aria-label="Представление задач"><button data-flow-view="list" type="button">'+icon('tasks')+' Список</button><button data-flow-view="board" type="button">'+icon('layout-grid')+' Доска</button></div>'+
     '<span class="flow-view-hint">Задачи сгруппированы по статусу</span>');
   nav.before(bar);
 }
 workspace.querySelectorAll('[data-flow-view]').forEach(btn=>{const selected=btn.dataset.flowView===viewMode;btn.classList.toggle('active',selected);btn.setAttribute('aria-pressed',String(selected))});
 workspace.querySelectorAll('.lin-group').forEach(group=>{
   const entriesBox=group.querySelector('.lin-group-entries');if(!entriesBox)return;
   if(!group.querySelector('.flow-columns')){
     const head=add('div','flow-columns','<span class="flow-cell-check" aria-hidden="true">☐</span><span>Название</span><span>Описание / следующий шаг</span><span>Крайний срок</span><span>Приоритет</span><span>Действия</span>');
     entriesBox.prepend(head);
   }
 });
 for(const row of workspace.querySelectorAll('.lin-row[data-sort-id]')){
   if(row.dataset.flowReady==='1')continue;
   const key=row.querySelector('[data-key]')?.getAttribute('data-key');
   const id=row.dataset.sortId,entry=lookup(id,key);
   if(!entry)continue;
   row.dataset.flowReady='1';
   const t=entry.task;
   const main=row.querySelector('.lin-row-body');
   if(!main)continue;
   const description=(t.nextStep||t.extra||t.waitingFor||'Открыть задачу для деталей').slice(0,150);
   const middle=add('span','flow-row-description',esc(description));
   const deadline=add('span','flow-row-deadline','<span class="'+(overdue(t)?'flow-overdue':'')+'">'+esc(formatDate(t.dueDate))+'</span>');
   const pri=add('span','flow-row-priority','<span class="flow-priority-badge flow-priority-'+esc(t.priority)+'">'+esc(priorityLabel(t))+'</span>');
   const button=add('button','flow-inspect-button',icon('arrow-right'));
   button.type='button';button.dataset.flowInspect=id;button.dataset.key=entry.key;button.setAttribute('aria-label','Подробнее: '+t.title);
   main.insertAdjacentElement('afterend',middle);
   middle.insertAdjacentElement('afterend',deadline);
   deadline.insertAdjacentElement('afterend',pri);
   const actions=row.querySelector('.lin-row-actions');
   if(actions)actions.append(button);else pri.insertAdjacentElement('afterend',button);
 }
}
function inspector(){
 let drawer=document.getElementById('flowInspector');
 if(drawer)return drawer;
 const veil=document.createElement('div');veil.className='flow-inspector-veil';veil.id='flowInspectorVeil';veil.hidden=true;veil.dataset.flowClose='';
 document.body.append(veil);
 drawer=document.createElement('aside');drawer.id='flowInspector';drawer.className='flow-inspector';drawer.setAttribute('role','dialog');drawer.setAttribute('aria-modal','false');drawer.setAttribute('aria-label','Детали задачи');drawer.hidden=true;
 document.body.append(drawer);return drawer;
}
function closeInspector(){const el=document.getElementById('flowInspector');if(el)el.hidden=true;const veil=document.getElementById('flowInspectorVeil');if(veil)veil.hidden=true;document.body.classList.remove('flow-inspecting');inspected=null;}
function inspect(id,key){
 const entry=lookup(id,key);if(!entry)return;
 inspected={id,key:entry.key};
 const t=entry.task,pr=projects().find(x=>String(x.id)===String(t.projectId));
 const rows=[
  ['Статус',({new:'К выполнению',inwork:'В работе',waiting:'Ожидание',done:'Готово'})[t.status]||t.status],
  ['Приоритет',priorityLabel(t)],['Сделать',formatDate(t.actionDate)],['Крайний срок',formatDate(t.dueDate)],
  ['Ответственный за ответ',t.waitingFor||'Не указан'],['Проверить ожидание',formatDate(t.waitingReminderAt)],
  ['Дело',pr?.title||'Личная задача']
 ];
 const el=inspector();
 el.innerHTML='<div class="flow-inspector-top"><span class="flow-eyebrow">ДЕТАЛИ ЗАДАЧИ</span><button type="button" data-flow-close aria-label="Закрыть">'+icon('close')+'</button></div>'+
  '<h2>'+esc(t.title)+'</h2>'+
  (t.extra?'<p class="flow-inspector-description">'+esc(t.extra)+'</p>':'')+
  '<div class="flow-inspector-properties">'+rows.map(([l,v])=>'<div><span>'+esc(l)+'</span><strong>'+esc(v)+'</strong></div>').join('')+'</div>'+
  '<div class="flow-inspector-next"><span class="flow-eyebrow">СЛЕДУЮЩИЙ ШАГ</span><p>'+esc(t.nextStep||'Пока не определён')+'</p></div>'+
  '<div class="flow-inspector-footer"><button type="button" data-flow-edit>Редактировать задачу</button><button type="button" data-flow-close>Закрыть</button></div>';
 el.hidden=false;document.getElementById('flowInspectorVeil').hidden=false;document.body.classList.add('flow-inspecting');
 el.querySelector('[data-flow-close]')?.focus();
}
function palette(){
 let node=document.getElementById('flowCommand');if(node)return node;
 node=add('section','flow-command','<div class="flow-command-box" role="dialog" aria-modal="true" aria-label="Быстрый поиск"><div class="flow-command-input">'+icon('search')+'<input id="flowCommandInput" type="search" placeholder="Поиск по задачам и делам..." autocomplete="off" aria-label="Поиск задач и дел"><button type="button" data-flow-close-command aria-label="Закрыть">Esc</button></div><div class="flow-command-results"></div><div class="flow-command-footnote">Поиск по названиям и описаниям · без отправки данных во внешние сервисы</div></div>');
 node.id='flowCommand';node.hidden=true;document.body.append(node);return node;
}
function searchResults(query){
 const q=query.trim().toLocaleLowerCase('ru');
 const tasks=entries().filter(x=>[x.task.title,x.task.extra,x.task.nextStep].some(v=>String(v||'').toLocaleLowerCase('ru').includes(q))).slice(0,8);
 const cases=projects().filter(p=>[p.title,p.description].some(v=>String(v||'').toLocaleLowerCase('ru').includes(q))).slice(0,4);
 const target=palette().querySelector('.flow-command-results');
 const taskRows=tasks.map(x=>'<button type="button" data-flow-command-task="'+esc(x.task.id)+'" data-key="'+esc(x.key)+'">'+icon('tasks')+'<span><strong>'+esc(x.task.title)+'</strong><small>Задача</small></span>'+icon('arrow-right')+'</button>');
 const caseRows=cases.map(x=>'<button type="button" data-flow-command-case="'+esc(x.id)+'">'+icon('folder')+'<span><strong>'+esc(x.title)+'</strong><small>Дело</small></span>'+icon('arrow-right')+'</button>');
 target.innerHTML=taskRows.concat(caseRows).join('')||'<p class="flow-command-empty">Ничего не найдено</p>';
}
function openCommand(){
 closeInspector();const el=palette();el.hidden=false;
 const input=el.querySelector('#flowCommandInput');input.value='';searchResults('');input.focus();
}
function closeCommand(){const el=document.getElementById('flowCommand');if(el)el.hidden=true;}
function decorate(){
 document.documentElement.classList.add('flow-ui');
 decorateNav();
 topbar();
 if(!state.projectId&&state.tab==='today')dashboard();
 if(!state.projectId&&state.tab==='tasks')decorateTasks();
}
const previousRender=render;
render=function flowRender(){closeInspector();previousRender();decorate();};
globalThis.render=render;
let pending=false;
const observer=new MutationObserver(list=>{
 if(state.tab!=='tasks'||!list.some(x=>x.type==='childList'))return;
 if(pending)return;
 pending=true;queueMicrotask(()=>{pending=false;if(state.tab==='tasks'&&!state.projectId)decorateTasks()});
});
observer.observe(page,{subtree:true,childList:true});
document.addEventListener('click',event=>{
 const button=event.target.closest('[data-flow-inspect],[data-flow-close],[data-flow-edit],[data-flow-command],[data-flow-close-command],[data-flow-command-task],[data-flow-command-case],[data-flow-view]');
 if(!button)return;
 event.preventDefault();event.stopImmediatePropagation();
 if(button.hasAttribute('data-flow-inspect')){inspect(button.dataset.flowInspect,button.dataset.key);return}
 if(button.hasAttribute('data-flow-close')){closeInspector();return}
 if(button.hasAttribute('data-flow-edit')){const entry=inspected&&lookup(inspected.id,inspected.key);closeInspector();if(entry)openTask(entry.task);return}
 if(button.hasAttribute('data-flow-command')){openCommand();return}
 if(button.hasAttribute('data-flow-close-command')){closeCommand();return}
 if(button.hasAttribute('data-flow-command-task')){const id=button.dataset.flowCommandTask,key=button.dataset.key;closeCommand();if(state.tab!=='tasks')switchTab('tasks');inspect(id,key);return}
 if(button.hasAttribute('data-flow-command-case')){const id=button.dataset.flowCommandCase;closeCommand();switchTab('projects');state.projectId=id;render();return}
 if(button.hasAttribute('data-flow-view')){viewMode=button.dataset.flowView==='board'?'board':'list';decorateTasks();return}
},true);
document.addEventListener('input',event=>{if(event.target.id==='flowCommandInput')searchResults(event.target.value)});
document.addEventListener('keydown',event=>{
 if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='k'){
   event.preventDefault();event.stopImmediatePropagation();openCommand();return;
 }
 if(event.key==='Escape'){
   if(document.getElementById('flowCommand')&&!document.getElementById('flowCommand').hidden){event.stopImmediatePropagation();closeCommand();return}
   if(document.getElementById('flowInspector')&&!document.getElementById('flowInspector').hidden){event.stopImmediatePropagation();closeInspector()}
 }
},true);
render();
})();
