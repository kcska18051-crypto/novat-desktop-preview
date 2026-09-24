import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';

const require = createRequire(import.meta.url);
const modulePath = process.env.NOVAT_PLAYWRIGHT_MODULE;
if (!modulePath) throw new Error('NOVAT_PLAYWRIGHT_MODULE is required');
const { chromium } = require(modulePath);
const root = path.resolve(import.meta.dirname, '..');
const types = { '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml', '.jpg': 'image/jpeg', '.JPG': 'image/jpeg', '.png': 'image/png' };
const server = http.createServer((request, response) => {
  const pathname = new URL(request.url, 'http://127.0.0.1').pathname;
  const file = path.join(root, pathname === '/' ? 'index.html' : pathname);
  if (!file.startsWith(root)) { response.writeHead(403).end(); return; }
  fs.readFile(file, (error, data) => {
    if (error) { response.writeHead(404).end(); return; }
    response.setHeader('Content-Type', types[path.extname(file)] || 'text/html');
    response.end(data);
  });
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });

try {
  await page.goto(`http://127.0.0.1:${server.address().port}/`, { waitUntil: 'networkidle' });
  const sourceCount = await page.locator('#list .data-item').count();
  const cardCount = await page.locator('#list .afisha-card').count();
  assert.ok(sourceCount > 0, 'source performances must exist');
  assert.equal(cardCount, sourceCount, 'every source performance becomes an editorial card');
  const first = page.locator('.afisha-card').first();
  for (const selector of ['.afisha-card__date', '.afisha-card__image img', '.afisha-card__venue', '.afisha-card__time', '.afisha-card__title', '.afisha-card__age', '.afisha-buy']) {
    assert.equal(await first.locator(selector).count(), 1, `first card exposes ${selector}`);
  }
  assert.ok((await first.locator('.afisha-card__image img').getAttribute('alt')).trim().length > 0);
  assert.match(await first.locator('.afisha-card__image img').getAttribute('src'), /^assets\//);
  const heading = page.locator('.c-list-wrap > .month');
  assert.equal((await heading.innerText()).trim(), 'СЕНТЯБРЬ, СБ');
  async function checkScrollingAndDrawer() {
    for (const [index, label] of [[1, 'СЕНТЯБРЬ, СР'], [3, 'СЕНТЯБРЬ, ПТ'], [0, 'СЕНТЯБРЬ, СБ']]) {
      await page.locator('.afisha-card').nth(index).evaluate(card => window.scrollTo({ top: window.scrollY + card.getBoundingClientRect().top - 25, behavior: 'instant' }));
      await page.waitForFunction(expected => document.querySelector('.c-list-wrap > .month').textContent.toUpperCase() === expected, label);
      assert.equal(Math.round(await heading.evaluate(el => el.getBoundingClientRect().top)), 0, 'combined heading stays at the top');
    }
    const button = page.locator('.afisha-cast-trigger').nth(1);
    await button.evaluate(el => window.scrollTo({ top: window.scrollY + el.getBoundingClientRect().top - 180, behavior: 'instant' }));
    const position = () => button.evaluate(el => {
      const rect = el.getBoundingClientRect();
      return { scroll: window.scrollY, x: rect.x, y: rect.y, width: document.documentElement.clientWidth, headingY: document.querySelector('.c-list-wrap > .month').getBoundingClientRect().top };
    });
    const before = await position();
    for (const close of ['Escape', 'button', 'backdrop']) {
      await button.click();
      assert.deepEqual(await position(), before, 'opening cast must not shift the page or sticky heading');
      if (close === 'Escape') await page.keyboard.press('Escape');
      else if (close === 'button') await page.locator('.afisha-drawer__close').click();
      else await page.locator('.afisha-drawer__backdrop').evaluate(el => el.click());
      assert.deepEqual(await position(), before, 'closing cast must preserve scroll and layout');
    }
  }
  await checkScrollingAndDrawer();
  const noCast = page.locator('.afisha-card[data-has-cast="false"]').first();
  if (await noCast.count()) assert.equal(await noCast.locator('.afisha-cast-trigger').count(), 0);
  const noDirector = page.locator('.afisha-card[data-has-director="false"]').first();
  if (await noDirector.count()) assert.equal(await noDirector.locator('.afisha-card__director').count(), 0);

  const visual = await first.evaluate(card => {
    const grid = card.querySelector('.afisha-card__grid');
    const button = card.querySelector('.afisha-buy');
    const date = card.querySelector('.afisha-card__date strong');
    return {
      grid: getComputedStyle(grid).display,
      columns: getComputedStyle(grid).gridTemplateColumns,
      divider: getComputedStyle(card).borderTopWidth,
      buttonBorder: getComputedStyle(button).borderTopWidth,
      dateColor: getComputedStyle(date).color
    };
  });
  assert.equal(visual.grid, 'grid');
  assert.ok(visual.columns.split(' ').length >= 4);
  assert.equal(visual.divider, '1px');
  assert.equal(visual.buttonBorder, '1px');
  assert.equal(visual.dateColor, 'rgb(83, 5, 44)');

  assert.ok(await page.locator('.afisha-pushkin').count() > 0, 'Pushkin marker is visible for eligible cards');
  await first.locator('.afisha-card__image img').evaluate(image => { image.src = '/assets/missing-poster.jpg'; });
  await page.waitForFunction(() => document.querySelector('.afisha-card__image')?.classList.contains('is-fallback'));

  const trigger = page.locator('.afisha-cast-trigger').first();
  await trigger.focus();
  await trigger.click();
  const drawer = page.locator('.afisha-drawer');
  assert.equal(await drawer.getAttribute('aria-hidden'), 'false');
  assert.equal(await page.locator('body').evaluate(body => body.classList.contains('afisha-drawer-open')), true);
  assert.equal(await drawer.locator('.afisha-drawer__title').innerText(), await trigger.evaluate(button => button._cast.title));
  await page.keyboard.press('Escape');
  assert.equal(await drawer.getAttribute('aria-hidden'), 'true');
  assert.equal(await trigger.evaluate(button => button === document.activeElement), true);
  await trigger.click();
  await page.locator('.afisha-drawer__close').focus();
  await page.keyboard.press('Shift+Tab');
  assert.equal(await drawer.evaluate(element => element.contains(document.activeElement)), true);
  await page.locator('.afisha-drawer__close').click();

  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload({ waitUntil: 'networkidle' });
  const mobile = await page.evaluate(() => ({
    overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    columns: getComputedStyle(document.querySelector('.afisha-card__grid')).gridTemplateColumns,
    monthPosition: getComputedStyle(document.querySelector('.c-list-wrap > .month')).position,
    order: ['.afisha-card__date', '.afisha-card__image', '.afisha-card__main', '.afisha-card__meta'].map(selector => Math.round(document.querySelector(`.afisha-card ${selector}`).getBoundingClientRect().top))
  }));
  assert.ok(mobile.overflow <= 0, 'mobile page must not overflow horizontally');
  assert.equal(mobile.columns.split(' ').length, 2);
  assert.equal(mobile.monthPosition, 'sticky');
  assert.deepEqual(mobile.order, [...mobile.order].sort((a, b) => a - b));
  assert.equal(await page.locator('.afisha-card__date').first().innerText(), '05');
  const toggle = page.getByRole('button', { name: 'Открыть меню', exact: true });
  await toggle.click();
  assert.equal(await page.locator('#novat-mobile-menu').evaluate(el => el.open), true);
  assert.equal(await page.locator('#novat-mobile-menu').getByRole('link', {name: 'Афиша', exact: true}).isVisible(), true);
  await page.keyboard.press('Escape');
  assert.equal(await toggle.getAttribute('aria-expanded'), 'false');
  assert.equal(await toggle.evaluate(el => el === document.activeElement), true);
  await toggle.click();
  await page.getByRole('button', {name: 'Закрыть меню', exact: true}).click();
  assert.equal(await page.locator('#novat-mobile-menu').evaluate(el => el.open), false);
  const filterToggle = page.locator('[aria-controls="collapseExample"]');
  await filterToggle.click();
  assert.equal(await page.locator('#collapseExample').isVisible(), true);
  await filterToggle.click();
  assert.equal(await page.locator('#collapseExample').isVisible(), false);
  await checkScrollingAndDrawer();
  await page.locator('.afisha-cast-trigger').first().click();
  const drawerWidth = await page.locator('.afisha-drawer').evaluate(element => Math.round(element.getBoundingClientRect().width));
  assert.equal(drawerWidth, await page.locator('.afisha-drawer-layer').evaluate(el => Math.round(el.getBoundingClientRect().width)));
  console.log('Afisha editorial browser checks passed.');
} finally {
  await browser.close();
  await new Promise(resolve => server.close(resolve));
}
