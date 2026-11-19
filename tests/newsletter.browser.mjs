import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const {chromium,devices}=createRequire(import.meta.url)(process.env.NOVAT_PLAYWRIGHT_MODULE);
const root=path.resolve(import.meta.dirname,'..');
const server=http.createServer((req,res)=>{const f=path.join(root,new URL(req.url,'http://local').pathname);fs.readFile(f,(e,d)=>{if(e)return res.writeHead(404).end();res.setHeader('Content-Type',({'.html':'text/html','.css':'text/css','.js':'text/javascript','.svg':'image/svg+xml','.png':'image/png'})[path.extname(f)]||'application/octet-stream');res.end(d)})});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch();
try {
 for(const [file,mobile] of [['index.html',false],['theatre.html',false],['brandbook.html',false],['index.html',true],['brandbook.html',true]]) {
  const page=await browser.newPage(mobile?devices['iPhone 13']:{viewport:{width:1440,height:1000}});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(`http://127.0.0.1:${server.address().port}/${file}`,{waitUntil:'networkidle'});
  await page.evaluate(()=>document.fonts.ready);
  assert.equal(await page.locator('.aside-part .subscribe input').count(),0);
  const button=mobile?page.locator('.newsletter-mobile-entry .newsletter-trigger'):page.locator('.aside-part .newsletter-trigger');
  const before=await page.evaluate(()=>scrollY);
  await button.click();
  const position=await page.evaluate(()=>scrollY);
  const dialog=page.locator('#newsletter-dialog');
  assert.ok(await dialog.evaluate(e=>e.open));
  const size=await dialog.evaluate(e=>({width:e.getBoundingClientRect().width,x:e.getBoundingClientRect().x,screen:document.documentElement.clientWidth}));
  assert.equal(Math.round(size.width),mobile?390:480);
  assert.ok(Math.abs(size.x+size.width-size.screen)<=(mobile?1:16),'right-aligned within the reserved desktop scrollbar gutter');
  assert.equal(await dialog.locator('input[name=consent]').isChecked(),false);
  assert.equal(await dialog.locator('form').evaluate(e=>e.checkValidity()),false);
  await dialog.locator('input[type=email]').fill('not-an-email');
  assert.equal(await dialog.locator('form').evaluate(e=>e.checkValidity()),false);
  await dialog.locator('input[type=email]').fill('viewer@example.com');
  await dialog.locator('input[name=consent]').check();
  await dialog.getByRole('button',{name:'Подписаться',exact:true}).click();
  assert.ok(await dialog.getByRole('status').isVisible());
  assert.match(await dialog.getByRole('status').innerText(),/не оформляется/);
  await page.keyboard.press('Escape');
  await page.waitForFunction(()=>!document.querySelector('#newsletter-dialog').open);
  assert.ok(Math.abs(await page.evaluate(()=>scrollY)-position)<2);
  assert.ok(await button.evaluate(e=>e===document.activeElement));
  if(mobile){
   await page.evaluate(()=>scrollTo({top:0,behavior:'instant'}));
   const openMenu=page.getByRole('button',{name:'Открыть меню',exact:true});
   await openMenu.click();
   const menu=page.locator(file==='index.html'?'#novat-mobile-menu':'#brandbook-menu');
   await menu.locator('.newsletter-trigger').click();
   assert.ok(await dialog.evaluate(e=>e.open));
   await dialog.getByRole('button',{name:'Закрыть подписку'}).click();
   await page.waitForFunction(()=>!document.querySelector('#newsletter-dialog').open);
   assert.ok(await menu.evaluate(e=>e.open),'return to the mobile menu');
   await page.keyboard.press('Escape');
  }
  assert.deepEqual(errors,[]);
  fs.mkdirSync(path.join(root,'.superpowers/newsletter'),{recursive:true});
  await page.evaluate(()=>scrollTo({top:0,behavior:'instant'}));
  if(file==='index.html'){
    if(!mobile)await page.screenshot({path:path.join(root,'.superpowers/newsletter/sidebar.png'),scale:'css'});
    const entry=mobile?page.locator('.newsletter-mobile-entry .newsletter-trigger'):button;
    await entry.click();
    await page.screenshot({path:path.join(root,`.superpowers/newsletter/${mobile?'mobile':'desktop'}.png`),scale:'css'});
  }
  console.log('PASS newsletter',file,mobile?'mobile':'desktop');
  await page.close();
 }
} finally {await browser.close();await new Promise(r=>server.close(r));}
