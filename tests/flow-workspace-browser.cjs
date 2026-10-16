/* Acceptance checks for the new icon-rail workspace and table layout. */
const assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path'),http=require('node:http');
let pw;try{pw=require('playwright')}catch{pw=require(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES+'/playwright')}
const root=path.resolve(__dirname,'..'),host='http://127.0.0.1:8789';
const server=http.createServer(async(req,res)=>{try{const target=decodeURIComponent(new URL(req.url,host).pathname);const file=path.resolve(root,'.'+(target==='/'?'/index.html':target));if(!file.startsWith(root+path.sep))return res.writeHead(403).end();const body=await fs.readFile(file),ext=path.extname(file);res.writeHead(200,{'Content-Type':{'.html':'text/html','.js':'application/javascript','.css':'text/css','.json':'application/json','.ttf':'font/ttf','.png':'image/png'}[ext]||'application/octet-stream'}).end(body)}catch{res.writeHead(404).end()}});
(async()=>{
await new Promise(done=>server.listen(8789,'127.0.0.1',done));
const browser=await pw.chromium.launch({headless:true,executablePath:process.env.TEST_BROWSER_EXECUTABLE||undefined,args:['--no-sandbox']});
try{
const p=await browser.newPage({viewport:{width:1440,height:900}});
const exceptions=[];p.on('pageerror',e=>exceptions.push(e.message));
await p.goto(host);await p.locator('.ref-today-body').waitFor();
assert.ok(await p.locator('.flow-topbar').isVisible(),'workspace topbar must exist');
assert.ok(await p.locator('.flow-dashboard').count(),'Today should have concise productive summary');
assert.ok(await p.locator('#tabs').evaluate(x=>x.getBoundingClientRect().width<=115),'desktop navigation must be compact icon rail');
assert.ok(await p.locator('#tabs [data-tab="tasks"]').evaluate(x=>x.getBoundingClientRect().height>=44),'rail tap target');
await p.locator('#tabs [data-tab="tasks"]').click();
await p.locator('.lin-toolbar [data-ref-new-task]').click();
await p.locator('#task-title').fill('Проверить договор аренды');
await p.locator('#task-status').selectOption('inwork');
await p.locator('#taskForm [type="submit"]').click();
await p.locator('.flow-columns').first().waitFor();
assert.match(await p.locator('.flow-columns').first().innerText(),/Название/);
assert.match(await p.locator('.flow-columns').first().innerText(),/срок/i);
assert.ok(await p.locator('.lin-row [data-flow-inspect]').count(),'inspect action available');
await p.locator('.lin-row [data-flow-inspect]').first().click();
assert.ok(await p.locator('#flowInspector').isVisible(),'click opens nonmodal detail pane');
assert.match(await p.locator('#flowInspector').innerText(),/Проверить договор аренды/);
await p.keyboard.press('Escape');assert.ok(!await p.locator('#flowInspector').isVisible(),'Escape closes pane');
await p.locator('[data-flow-view="board"]').click();
assert.ok(await p.locator('.lin-workspace').evaluate(x=>x.classList.contains('flow-board-view')),'kanban board view must activate');
await p.locator('[data-flow-view="list"]').click();
assert.ok(await p.locator('.lin-workspace').evaluate(x=>!x.classList.contains('flow-board-view')),'list mode restored');
await p.keyboard.press('Control+k');
assert.ok(await p.locator('#flowCommand').isVisible(),'keyboard command palette opens');
await p.locator('#flowCommandInput').fill('аренды');
assert.match(await p.locator('.flow-command-results').innerText(),/Проверить договор аренды/);
await p.keyboard.press('Escape');
for(const tab of ['today','tasks','projects','priorities']){
 await p.locator('#tabs [data-tab="'+tab+'"]').click();
 assert.equal(await p.locator('.flow-topbar').count()>0,tab!=='priorities','redundant topbar removed only for priorities '+tab);
 assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'desktop overflow '+tab);
}
await p.setViewportSize({width:390,height:844});
for(const tab of ['today','tasks','projects','priorities']){
 await p.locator('#tabs [data-tab="'+tab+'"]').click();
 assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'mobile overflow '+tab);
}
await p.locator('#tabs [data-tab="today"]').click();
assert.equal(await p.locator('.flow-daily-intro h2,.flow-daily-intro p').count(),0,'redundant daily greeting and subtitle removed');
assert.ok(await p.locator('.flow-daily-intro .flow-eyebrow').isVisible(),'today still displays date label');
await p.locator('#tabs [data-tab="tasks"]').click();
assert.equal(await p.locator('.lin-expand svg path').count(),4,'group arrows are consistent SVG chevrons');
const firstGroup=p.locator('.lin-group-heading').first();
const initialExpansion=await firstGroup.getAttribute('aria-expanded');
await firstGroup.click();
assert.notEqual(await firstGroup.getAttribute('aria-expanded'),initialExpansion,'task group expands and collapses');
await firstGroup.click();
assert.equal(await firstGroup.getAttribute('aria-expanded'),initialExpansion,'task group is restored');
const tidy=await p.evaluate(()=>{
  const box=el=>{const r=el.getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height}};
  const sync=box(document.querySelector('.lin-toolbar [data-ref-sync]'));
  const tpl=box(document.querySelector('.lin-toolbar [data-lin-templates]'));
  const list=box(document.querySelector('.flow-view-selector [data-flow-view="list"]'));
  const board=box(document.querySelector('.flow-view-selector [data-flow-view="board"]'));
  const search=box(document.querySelector('.lin-search'));
  return {sync,tpl,list,board,search,width:innerWidth,scrollWidth:document.documentElement.scrollWidth};
});
assert.ok(tidy.sync.right+3<=tidy.tpl.left && Math.abs(tidy.sync.width-tidy.tpl.width)<=3,'equal secondary buttons do not overlap '+JSON.stringify(tidy));
assert.ok(tidy.list.right+3<=tidy.board.left && Math.abs(tidy.list.width-tidy.board.width)<=3,'list and board segments aligned '+JSON.stringify(tidy));
assert.ok(tidy.list.bottom<=tidy.search.top && tidy.board.bottom<=tidy.search.top,'view selector ends above search '+JSON.stringify(tidy));
assert.ok(tidy.tpl.right<=tidy.width+1 && tidy.board.right<=tidy.width+1 && tidy.scrollWidth<=tidy.width+1,'no mobile control overflow');
await p.locator('.lin-toolbar [data-ref-new-task]').click();
const dateBoxes=await p.evaluate(()=>{
  const a=document.querySelector('#task-actionDate'),b=document.querySelector('#task-dueDate'),sheet=document.querySelector('#taskSheet .sheet-fields');
  const r=a.getBoundingClientRect(),s=b.getBoundingClientRect();
  return {first:{left:r.left,right:r.right,top:r.top,bottom:r.bottom},second:{left:s.left,right:s.right,top:s.top,bottom:s.bottom},scroll:sheet.scrollWidth,client:sheet.clientWidth};
});
assert.ok(dateBoxes.first.bottom+4<=dateBoxes.second.top,'iOS date controls do not overlap '+JSON.stringify(dateBoxes));
assert.ok(dateBoxes.scroll<=dateBoxes.client+1,'task form has no horizontal content overflow '+JSON.stringify(dateBoxes));
await p.locator('#cancelTask').click();
await p.locator('.lin-row [data-flow-inspect]').first().click();
const dim=await p.locator('#flowInspector').evaluate(x=>{const r=x.getBoundingClientRect();return {width:r.width,left:r.left,right:r.right}});
assert.ok(dim.left>=0&&dim.right<=391,'mobile detail sheet is within viewport '+JSON.stringify(dim));
assert.ok(await p.locator('#task-title').evaluate(x=>parseFloat(getComputedStyle(x).fontSize))>=16,'iPhone editor no autozoom');
assert.deepEqual(exceptions,[],'browser errors '+exceptions.join(' ; '));
console.log('FLOW_WORKSPACE_PASS: icon rail, summary, structured list, kanban toggle, inspector, command search and 4 mobile screens');
}finally{await browser.close();await new Promise(done=>server.close(done))}
})().catch(e=>{console.error(e);process.exitCode=1;server.close()});
