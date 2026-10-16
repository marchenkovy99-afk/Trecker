/* Pixel and interaction contract for the premium lawyer workspace. */
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const path=require('node:path');
const http=require('node:http');
let playwright;
try{playwright=require('playwright')}catch{playwright=require(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES+'/playwright')}
const root=path.resolve(__dirname,'..');
const origin='http://127.0.0.1:8776';
const server=http.createServer(async(request,response)=>{
  try{
    const pathname=decodeURIComponent(new URL(request.url,origin).pathname);
    const file=path.resolve(root,'.'+(pathname==='/'?'/index.html':pathname));
    if(!file.startsWith(root+path.sep)){response.writeHead(403);response.end();return}
    const data=await fs.readFile(file);
    const type={'.html':'text/html; charset=utf-8','.js':'application/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.png':'image/png','.svg':'image/svg+xml','.json':'application/json','.webmanifest':'application/manifest+json'}[path.extname(file)]||'application/octet-stream';
    response.writeHead(200,{'Content-Type':type});response.end(data)
  }catch{response.writeHead(404);response.end('Not found')}
});
const run=async()=>{
 await new Promise(resolve=>server.listen(8776,'127.0.0.1',resolve));
 const browser=await playwright.chromium.launch({headless:true,executablePath:process.env.TEST_BROWSER_EXECUTABLE||undefined,args:['--no-sandbox']});
 const shots=process.env.TEST_SCREENSHOT_DIR||'/tmp/tracker-premium-qa';
 await fs.mkdir(shots,{recursive:true});
 try{
   const page=await browser.newPage({viewport:{width:1440,height:900},deviceScaleFactor:1,acceptDownloads:true});
   const errors=[];page.on('pageerror',error=>errors.push(error.message));
   await page.goto(origin);
   await page.locator('#tabs [data-tab="tasks"]').click();
   await page.locator('.lin-workspace').waitFor();
   await page.locator('.lin-toolbar [data-ref-new-task]').click();
   await page.locator('#task-title').fill('Проверить условия договора с контрагентом');
   await page.locator('#task-status').selectOption('inwork');
   await page.locator('#taskForm [type="submit"]').click();
   await page.locator('.lin-row').first().waitFor();
   for(const width of [360,390,768,1024,1440,1920]){
     await page.setViewportSize({width,height:900});
     await page.locator('#tabs [data-tab="tasks"]').click();
     const geometry=await page.evaluate(()=>{
       const rect=s=>{const node=document.querySelector(s);if(!node)throw new Error('Missing UI: '+s);const box=node.getBoundingClientRect(),css=getComputedStyle(node);return {left:box.left,right:box.right,width:box.width,height:box.height,font:parseFloat(css.fontSize),display:css.display}};
       return {screen:innerWidth,document:document.documentElement.scrollWidth,
         heading:rect('.lin-heading'),bar:rect('.lin-listbar'),groups:rect('.lin-groups'),
         row:rect('.lin-row'),title:rect('.lin-title'),
         toggle:rect('.lin-row .lin-tick'),action:rect('.lin-row .lin-small-action'),
         tab:rect('#tabs [data-tab="tasks"]'),toolbar:rect('.lin-toolbar')};
     });
     assert.ok(geometry.document<=width+1,JSON.stringify({width,issue:'horizontal document overflow',geometry}));
     assert.ok(geometry.title.font>=14,'task typography must read comfortably at '+width+'px: '+geometry.title.font);
     assert.ok(geometry.toggle.width>=38&&geometry.toggle.height>=38,'completion touch target must be >=38×38 at '+width);
     assert.ok(geometry.action.width>=36&&geometry.action.height>=36,'task controls must be >=36×36 at '+width);
     assert.ok(geometry.tab.height>=42,'navigation touch target must be >=42 at '+width);
     assert.ok(Math.abs(geometry.heading.left-geometry.bar.left)<3&&Math.abs(geometry.bar.left-geometry.groups.left)<3,'major areas must share a single aligned container at '+width);
     assert.ok(geometry.row.left>=-1&&geometry.row.right<=width+1,'task rows within viewport at '+width);
     assert.ok(geometry.row.height>45&&geometry.row.height<220,'task row height must remain compact and visible at '+width+': '+geometry.row.height);
     await page.screenshot({path:path.join(shots,'premium-tasks-'+width+'.png'),fullPage:false});
   }
   await page.setViewportSize({width:390,height:844});
   await page.locator('#tabs [data-tab="tasks"]').click();
   const diagnostic=await page.evaluate(()=>{
     const row=document.querySelector('.lin-row');
     const group=row?.closest('.lin-group');
     const entries=row?.closest('.lin-group-entries');
     const box=row?.getBoundingClientRect();
     return {rowCount:document.querySelectorAll('.lin-row').length,tab:document.querySelector('#tabs [aria-selected="true"]')?.dataset.tab,group:group?.dataset.status,expanded:group?.querySelector('.lin-group-heading')?.getAttribute('aria-expanded'),entriesHidden:entries?.hidden,entriesDisplay:entries?getComputedStyle(entries).display:null,rowDisplay:row?getComputedStyle(row).display:null,rowBox:box?{width:box.width,height:box.height,top:box.top}:null};
   });
   console.log('PREMIUM_MOBILE_ROW',JSON.stringify(diagnostic));
   assert.ok(diagnostic.rowBox?.height>0,'at least one task row must stay visible after responsive transitions: '+JSON.stringify(diagnostic));
   await page.locator('.lin-row .lin-row-body').first().click({timeout:5000});
   await page.locator('[data-task-detail-edit]').click();
   const form=await page.evaluate(()=>({font:getComputedStyle(document.querySelector('#task-title')).fontSize,label:getComputedStyle(document.querySelector('label[for="task-title"]')).fontSize,form:document.querySelector('#taskSheet .sheet').getBoundingClientRect().width,screen:innerWidth}));
   assert.ok(parseFloat(form.font)>=16,'mobile editor must not autozoom');
   assert.ok(parseFloat(form.label)>=12,'mobile editor labels must remain legible');
   assert.ok(form.form<form.screen,'editor must fit inside mobile viewport');
   await page.screenshot({path:path.join(shots,'premium-task-form-mobile.png'),fullPage:false});
   await page.keyboard.press('Escape');
   await page.locator('#tabs [data-tab="projects"]').click();
   await page.screenshot({path:path.join(shots,'premium-cases-mobile.png'),fullPage:false});
   await page.locator('#tabs [data-tab="today"]').click();
   await page.screenshot({path:path.join(shots,'premium-today-mobile.png'),fullPage:false});
   assert.deepEqual(errors,[],'no script errors');
   console.log('PREMIUM_VISUAL_PASS: 6 widths, aligned surfaces, readable typography, usable touch targets, mobile form and primary tabs');
 }finally{await browser.close();await new Promise(resolve=>server.close(resolve))}
};
run().catch(error=>{console.error(error);process.exitCode=1;server.close()});
