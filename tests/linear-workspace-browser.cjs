/* End-to-end checks for the Linear-inspired lawyer workspace, via the real browser. */
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const path=require('node:path');
const http=require('node:http');
let pw;
try{pw=require('playwright')}catch{pw=require(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES+'/playwright')}
const root=path.resolve(__dirname,'..');
const host='http://127.0.0.1:8774';
const server=http.createServer(async(req,res)=>{
  const p=new URL(req.url,host).pathname;
  const file=path.resolve(root,'.'+(p==='/'?'/index.html':p));
  if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}
  try{const b=await fs.readFile(file),ext=path.extname(file);res.writeHead(200,{'Content-Type':({'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.svg':'image/svg+xml'}[ext]||'application/octet-stream')});res.end(b)}catch{res.writeHead(404).end();}
});
(async()=>{
  await new Promise(resolve=>server.listen(8774,'127.0.0.1',resolve));
  const browser=await pw.chromium.launch({headless:true,executablePath:process.env.TEST_BROWSER_EXECUTABLE||undefined,args:['--no-sandbox']});
  try{
    const page=await browser.newPage({viewport:{width:1440,height:920}});
    const errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.goto(host);
    await page.locator('#tabs [data-tab="tasks"]').click();
    await page.locator('.lin-workspace').waitFor();
    assert.equal(await page.locator('.lin-group').count(),4,'tasks grouped by status');
    await page.locator('[data-lin-templates]').click();
    await page.locator('[data-lin-preset="opinion"]').click();
    await page.locator('#task-title').waitFor();
    assert.match(await page.locator('#task-title').inputValue(),/заключен/i);
    await page.locator('#task-title').fill('Проверка нового порядка');
    await page.locator('[name="actionDate"]').fill('2026-10-17');
    await page.locator('[name="dueDate"]').fill('2026-10-21');
    await page.locator('[name="waitingFor"]').fill('Юридический департамент');
    await page.locator('[name="waitingReminderAt"]').fill('2026-10-18');
    await page.locator('[name="nextStep"]').fill('Получить комментарии коллег');
    await page.locator('[name="status"]').selectOption('waiting');
    await page.locator('#taskForm [type="submit"]').click();
    const stored=await page.evaluate(()=>JSON.parse(localStorage.getItem('lawyerTasks')||'[]'));
    const added=stored.find(x=>x.title==='Проверка нового порядка');
    assert.ok(added,'preset produces a saved task');
    assert.equal(added.actionDate,'2026-10-17');
    assert.equal(added.dueDate,'2026-10-21');
    assert.equal(added.waitingFor,'Юридический департамент');
    assert.equal(added.waitingReminderAt,'2026-10-18');
    assert.equal(added.nextStep,'Получить комментарии коллег');
    await page.locator('[data-lin-filter="waiting"]').click();
    assert.match(await page.locator('.lin-workspace').innerText(),/Юридический департамент/);
    await page.locator('[data-lin-history]').click();
    assert.match(await page.locator('#linHistoryDialog').innerText(),/История/i);
    await page.locator('[data-lin-close-history]').click();
    await page.setViewportSize({width:390,height:844});
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'mobile should have no horizontal overflow');
    assert.equal(errors.length,0,'no browser script errors: '+errors.join(' | '));
    await page.close();
    console.log('PASS Linear-inspired workspace: status groups, presets, dates, waiting, next step, history, mobile layout');
  }finally{await browser.close();await new Promise(resolve=>server.close(resolve))}
})().catch(e=>{console.error(e);process.exitCode=1;server.close()});
