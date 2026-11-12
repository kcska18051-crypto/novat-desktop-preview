import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const {chromium, devices} = createRequire(import.meta.url)(process.env.NOVAT_PLAYWRIGHT_MODULE);
const root = path.resolve(import.meta.dirname, '..');
const server = http.createServer((req,res) => {
  const pathname = new URL(req.url,'http://local').pathname;
  const file = path.join(root, pathname === '/' ? 'index.html' : pathname);
  fs.readFile(file,(error,data) => {
    if(error) return res.writeHead(404).end();
    res.setHeader('Content-Type',({'.css':'text/css','.js':'text/javascript','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.otf':'font/otf','.ttf':'font/ttf'})[path.extname(file)]||'text/html');
    res.end(data);
  });
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const browser = await chromium.launch();
try {
  for(const [name,profile] of [['iphone',devices['iPhone 13']],['android',devices['Pixel 7']],['small',{...devices['iPhone SE'],viewport:{width:320,height:640}}]]) {
    const page=await browser.newPage(profile);
    const errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    await page.goto(`http://127.0.0.1:${server.address().port}/`,{waitUntil:'networkidle'});
    await page.evaluate(()=>document.fonts.ready);
    const layout=await page.evaluate(()=>({width:innerWidth,screen:screen.width,scale:visualViewport.scale,overflow:document.documentElement.scrollWidth-innerWidth}));
    assert.ok(Math.abs(layout.width-profile.viewport.width)<=1,`${name}: viewport follows the phone width, got ${layout.width}`);
    assert.ok(Math.abs(layout.scale-1)<0.01,`${name}: content is readable without page shrinking`);
    assert.ok(layout.overflow<=0,`${name}: no horizontal page scroll`);
    assert.ok(await page.locator('.novat-mobile-header').isVisible());
    assert.equal(await page.locator('.aside-part').isVisible(),false);
    const months=page.locator('.archive-wrapper .month-season.mobile');
    assert.ok(await months.isVisible());
    assert.equal(await page.locator('#collapseExample').isVisible(),false);
    const filter=page.locator('[aria-controls="collapseExample"]');
    await filter.click();
    assert.ok(await page.locator('#collapseExample').isVisible());
    await filter.click();
    assert.equal(await page.locator('#collapseExample').isVisible(),false);
    const menu=page.getByRole('button',{name:'Открыть меню',exact:true});
    await menu.click();
    assert.ok(await page.locator('#novat-mobile-menu').evaluate(e=>e.open));
    await page.getByRole('button',{name:'Закрыть меню',exact:true}).click();
    await page.waitForFunction(()=>document.querySelector('.novat-mobile-toggle').getAttribute('aria-expanded')==='false');
    assert.equal(await menu.getAttribute('aria-expanded'),'false');
    await page.locator('.afisha-card').first().scrollIntoViewIfNeeded();
    const first=page.locator('.afisha-card').first();
    const button=first.locator('.afisha-buy');
    assert.ok(await button.evaluate(e=>e.getBoundingClientRect().height>=44));
    const before=await page.evaluate(()=>scrollY);
    await first.locator('.afisha-cast-trigger').click();
    assert.equal(await page.locator('.afisha-drawer').getAttribute('aria-hidden'),'false');
    await page.locator('.afisha-drawer__close').click();
    assert.ok(Math.abs(await page.evaluate(()=>scrollY)-before)<2,'drawer does not jump the page');
    assert.deepEqual(errors,[]);
    fs.mkdirSync(path.join(root,'.superpowers/mobile-fix'),{recursive:true});
    await page.screenshot({path:path.join(root,`.superpowers/mobile-fix/${name}-card.png`),scale:'css'});
    await page.evaluate(()=>window.scrollTo({top:0,behavior:'instant'}));
    await page.screenshot({path:path.join(root,`.superpowers/mobile-fix/${name}-top.png`),scale:'css'});
    await page.setViewportSize({width:profile.viewport.height,height:profile.viewport.width});
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`${name}: landscape does not overflow`);
    console.log(`PASS ${name}: viewport, readable scale, menu, filters, tickets, drawer`);
    await page.close();
  }
} finally { await browser.close();await new Promise(resolve=>server.close(resolve)); }
