/* UX contract: independent weekly priorities, editorial type and mobile current-day focus. */
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const path=require('node:path');
const http=require('node:http');
let playwright;try{playwright=require('playwright')}catch{playwright=require(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES+'/playwright')}
const root=path.resolve(__dirname,'..'),origin='http://127.0.0.1:8777';
const server=http.createServer(async(req,res)=>{try{const name=decodeURIComponent(new URL(req.url,origin).pathname);const file=path.resolve(root,'.'+(name==='/'?'/index.html':name));if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return}const bytes=await fs.readFile(file);const types={'.html':'text/html','.css':'text/css','.js':'text/javascript','.json':'application/json','.png':'image/png','.ttf':'font/ttf'};res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream'}).end(bytes)}catch{res.writeHead(404).end()}});
const dayKey=d=>[d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');
(async()=>{
 await new Promise(resolve=>server.listen(8777,'127.0.0.1',resolve));
 const browser=await playwright.chromium.launch({headless:true,executablePath:process.env.TEST_BROWSER_EXECUTABLE||undefined,args:['--no-sandbox']});
 const dir=process.env.TEST_SCREENSHOT_DIR||'/tmp/weekly-priorities-qa';await fs.mkdir(dir,{recursive:true});
 try{
  const page=await browser.newPage({viewport:{width:1440,height:900}});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(origin);await page.locator('.ref-today-body').waitFor();
  assert.equal(await page.locator('#tabs .tab').count(),4,'four top-level tabs including independent Priorities');
  assert.equal(await page.locator('.lin-side-filters').count(),0,'old side task filter navigation must be gone');
  assert.equal(await page.locator('.ref-panel-heading h3').filter({hasText:'Ожидают ответа'}).count(),0,'obsolete waiting panel removed from Today');
  await page.locator('#tabs [data-tab="tasks"]').click();
  assert.equal(await page.locator('[data-lin-history]').count(),0,'History action removed from workspace UI');
  await page.locator('#tabs [data-tab="priorities"]').click();
  const board=page.locator('.priority-board'),days=page.locator('.priority-day');
  assert.equal(await days.count(),7,'exactly seven calendar days in each weekly page');
  const today=dayKey(new Date());const current=page.locator('.priority-day.is-today[aria-current="date"]');
  assert.equal(await current.getAttribute('data-priority-date'),today,'current calendar day highlighted');
  const desktop=await board.evaluate(el=>({scroll:el.scrollWidth,client:el.clientWidth,cols:getComputedStyle(el).gridTemplateColumns}));
  assert.ok(desktop.cols.trim().split(' ').length>=7,'desktop calendar has seven dedicated columns: '+JSON.stringify(desktop));
  await page.screenshot({path:path.join(dir,'weekly-priorities-desktop.png'),fullPage:false});
  await page.locator('.priority-day.is-today .priority-zone--main [data-priority-add]').click();
  await page.locator('#priorityTaskTitle').fill('Приоритет на сегодняшний день');
  await page.locator('#priorityForm [type="submit"]').click();
  assert.equal(await current.locator('.priority-card').count(),1);
  assert.ok(await page.evaluate(()=>JSON.parse(localStorage.getItem('lawyerTasks')||'[]').some(t=>t.title==='Приоритет на сегодняшний день'&&t.priorityDate===new Date().toLocaleDateString('sv-SE'))),'new weekly priority persists as ordinary task');
  await page.setViewportSize({width:390,height:844});
  await page.locator('#tabs [data-tab="tasks"]').click();
  await page.locator('#tabs [data-tab="priorities"]').click();
  const mobile=await page.evaluate(()=>{
    const b=document.querySelector('.priority-board'),d=document.querySelector('.priority-day.is-today'),r=b.getBoundingClientRect(),v=d.getBoundingClientRect();
    return {viewport:innerWidth,document:document.documentElement.scrollWidth,display:getComputedStyle(b).display,snap:getComputedStyle(b).scrollSnapType,boardLeft:r.left,boardRight:r.right,dayLeft:v.left,dayRight:v.right,dayWidth:v.width,top:v.top,windowScroll:scrollY,tabHeight:document.querySelector('#tabs [data-tab="priorities"]').getBoundingClientRect().height};
  });
  assert.ok(mobile.document<=mobile.viewport+1,'no mobile horizontal page overflow: '+JSON.stringify(mobile));
  assert.equal(mobile.display,'flex','mobile prioritiy days are a horizontal carousel');
  assert.match(mobile.snap,/x/,'mobile snaps horizontally between days');
  assert.ok(mobile.dayLeft>=mobile.boardLeft-6&&mobile.dayLeft<=mobile.boardLeft+22,'current day in first visible carousel position: '+JSON.stringify(mobile));
  assert.ok(mobile.dayWidth>=mobile.viewport*.78,'each day fills the mobile workspace');
  assert.ok(mobile.tabHeight>=44,'touch-safe priority navigation');
  await page.screenshot({path:path.join(dir,'weekly-priorities-mobile.png'),fullPage:false});
  await page.locator('[data-priority-week="next"]').click();
  assert.equal(await page.locator('.priority-day').count(),7);
  assert.equal(await page.locator('.priority-day.is-today').count(),0,'other week must not be flagged today');
  await page.locator('[data-priority-week="today"]').click();
  assert.equal(await page.locator('.priority-day.is-today').count(),1,'return to current calendar week');
  await page.locator('#tabs [data-tab="tasks"]').click();
  await page.locator('#tabs [data-tab="priorities"]').click();
  assert.equal(await page.locator('.priority-day.is-today').count(),1,'reopening prioritities always selects current week');
  // Mobile compactness, alignment, and one-touch move to another day.
  assert.equal(await page.getByText('Неделя приоритетов',{exact:true}).count(),0,'remove duplicate navigation heading');
  const compact=await page.evaluate(()=>{
    const board=document.querySelector('.priority-board');
    const day=document.querySelector('.priority-day.is-today');
    const title=document.querySelector('.priority-page-head h2');
    const weekday=day?.querySelector('.priority-day__head strong');
    const zone=day?.querySelector('.priority-zone--main');
    const add=zone?.querySelector('.priority-add');
    const zr=zone?.getBoundingClientRect(),ar=add?.getBoundingClientRect(),dr=day?.getBoundingClientRect();
    return {heading:parseFloat(getComputedStyle(title).fontSize),
      weekday:parseFloat(getComputedStyle(weekday).fontSize),height:dr?.height,
      dayRight:dr?.right,viewport:innerWidth,
      buttonRight:ar?.right,zoneRight:zr?.right,
      buttonText:add?.textContent?.trim(),buttonPseudo:getComputedStyle(add,'::before').content,
      fabVisible:!!document.getElementById('fab')?.getClientRects().length};
  });
  assert.ok(compact.heading<=29&&compact.weekday<=24,'compact typography: '+JSON.stringify(compact));
  assert.ok(compact.height<580,'compact day fits normal phone viewport: '+JSON.stringify(compact));
  assert.ok(compact.dayRight<=compact.viewport+1,'no clipped day card: '+JSON.stringify(compact));
  assert.ok(compact.buttonRight<=compact.zoneRight+2,'Add button must fit in day: '+JSON.stringify(compact));
  assert.equal(compact.buttonText,'+ Добавить','readable, complete Add label');
  assert.equal(compact.buttonPseudo,'none','do not duplicate plus signs');
  assert.equal(compact.fabVisible,false,'floating plus must not overlap priority day buttons');
  const moved=await page.locator('.priority-day.is-today .priority-card:not(.is-done) [data-set-priority]').first();
  await moved.click();
  const chips=page.locator('#priorityForm [data-priority-quick-day]');
  assert.equal(await chips.count(),7,'seven one-touch calendar day choices in the transfer sheet');
  const currentDay=dayKey(new Date());
  const otherDay=await chips.evaluateAll((nodes,current)=>nodes.map(n=>n.dataset.priorityQuickDay).find(v=>v!==current),currentDay); 
  assert.ok(otherDay&&otherDay!==currentDay,'choose a different weekday');
  await page.locator('#priorityForm [data-priority-quick-day="'+otherDay+'"]').click();
  assert.ok(await page.evaluate(expected=>(JSON.parse(localStorage.getItem('lawyerTasks')||'[]').find(t=>t.title==='Приоритет на сегодняшний день')||{}).priorityDate===expected,otherDay),'quick transfer persists priorityDate to existing root task');
  assert.equal(await page.locator('#prioritySheet.show').count(),0,'day transfer closes picker');
  for(const width of [320,360,390,430]){
    await page.setViewportSize({width,height:844});
    await page.locator('#tabs [data-tab="tasks"]').click();
    await page.locator('#tabs [data-tab="priorities"]').click();
    const measure=await page.evaluate(()=>{
      const day=document.querySelector('.priority-day.is-today'),board=document.querySelector('.priority-board');
      const zone=day?.querySelector('.priority-zone--main'),button=zone?.querySelector('.priority-add');
      const card=day?.getBoundingClientRect(),container=board?.getBoundingClientRect(),slot=zone?.getBoundingClientRect(),add=button?.getBoundingClientRect();
      return {screen:innerWidth,scroll:document.documentElement.scrollWidth,
        dayLeft:card?.left,dayRight:card?.right,boardLeft:container?.left,boardRight:container?.right,
        addLeft:add?.left,addRight:add?.right,slotLeft:slot?.left,slotRight:slot?.right,
        dayHeight:card?.height,buttonWidth:add?.width,
        typeSize:parseFloat(getComputedStyle(document.querySelector('.priority-day__head strong')).fontSize)};
    });
    assert.ok(measure.scroll<=width+1,'mobile screen width '+width+': '+JSON.stringify(measure));
    assert.ok(measure.dayLeft>=measure.boardLeft-5&&measure.dayRight<=measure.boardRight+2,'day inside carousel '+width+': '+JSON.stringify(measure));
    assert.ok(measure.addLeft>=measure.slotLeft-2&&measure.addRight<=measure.slotRight+2,'Add button within zone '+width+': '+JSON.stringify(measure));
    assert.ok(measure.dayHeight<580&&measure.typeSize<=24,'day card remains compact '+width+': '+JSON.stringify(measure));
    assert.ok(measure.buttonWidth>=74,'Add control stays tappable '+width+': '+JSON.stringify(measure));
    await page.screenshot({path:path.join(dir,'weekly-priorities-compact-'+width+'.png'),fullPage:false});
  }
  const zoom=await page.evaluate(()=>{
    const v=document.querySelector('meta[name=viewport]').content;
    const fields=[...document.querySelectorAll('input:not([type=hidden]),textarea,select')].filter(el=>el.getBoundingClientRect().width>0);
    return {viewport:v,minFieldSize:Math.min(...fields.map(el=>parseFloat(getComputedStyle(el).fontSize))),overflow:document.documentElement.scrollWidth-innerWidth};
  });
  assert.ok(zoom.minFieldSize>=16,'mobile form fields must avoid iOS autozoom: '+JSON.stringify(zoom));
  assert.ok(zoom.overflow<=1,'mobile page not wider than viewport');
  assert.deepEqual(errors,[],'no browser exceptions');
  console.log('WEEKLY_PRIORITIES_PASS: independent tab; no obsolete panels; seven calendar days; current-day mobile snap; weekly navigation; storage; mobile zoom and overflow');
 }finally{await browser.close();await new Promise(resolve=>server.close(resolve))}
})().catch(e=>{console.error(e);process.exitCode=1;server.close()});
