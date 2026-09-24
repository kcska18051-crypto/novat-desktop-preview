# Afisha Editorial Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the NOVAT performance list as a light editorial schedule with separate dates, local announcement images, venue/time metadata, ticket CTAs, Pushkin Card markers, and an accessible cast drawer.

**Architecture:** Keep the existing HTML as the source of performance data and progressively enhance each list item in a dedicated `afisha.js` module. The module extracts the current title, date, venue, time, age, cast, director, Pushkin Card flag, and calendar image, then replaces only the visual body of that item with semantic editorial-card markup. CSS owns layout and responsive presentation; JavaScript owns data extraction, fallback images, and drawer behavior.

**Tech Stack:** Static HTML, CSS custom properties and Grid, vanilla JavaScript, PowerShell regression checks, Playwright browser verification through the bundled Codex runtime.

**Spec:** `docs/superpowers/specs/2026-09-24-afisha-editorial-redesign-design.md`

## Global Constraints

- Burgundy is exactly `#53052C`.
- Yellow is exactly `#E2B267`; light cream is exactly `#F2E6D1`; the page background is white.
- Every divider and outlined control uses a `1px` border.
- Preserve the current sidebar, logos, pictograms, favicon, filters, month navigation, sticky month, separated date numerals, and all previously approved corrections.
- Use only local announcement images already stored in `assets/`; add no remote runtime dependency.
- Cast details open on click in a right drawer, not on hover.
- Cards use no shadows, heavy frames, or decorative rounding.

## Review Focus

- Two performances on the same date: render one date heading while preserving both independent cards and times.
- Missing or broken poster image: show the branded fallback without collapsing the grid or exposing broken-image UI.
- Performance without a cast list or director: keep the card aligned and omit only the unavailable control or field.
- Keyboard-only drawer use: focus enters the drawer, stays trapped, Escape closes it, and focus returns to the triggering button.
- A 390px viewport: no horizontal overflow; the card stacks in the approved order and the drawer fills the viewport.

---

### Task 1: Browser Contract and Editorial Card Enhancement

**Files:**
- Create: `tests/afisha-editorial.browser.mjs`
- Create: `afisha.js`
- Modify: `index.html:295-297,2958`

**Interfaces:**
- Consumes: existing `#list .c-list-wrap > .data-item` nodes and `#calendar img.data-item__background` nodes.
- Produces: `window.NovatAfisha.init()`, `.afisha-card`, `.afisha-day-heading`, and the `afisha:ready` document event used by browser checks and later tasks.

- [ ] **Step 1: Write the failing desktop structure test**

Create `tests/afisha-editorial.browser.mjs` with a local static server and the explicit Playwright module path supplied through `NOVAT_PLAYWRIGHT_MODULE`:

```js
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
  for (const selector of ['.afisha-card__date', '.afisha-card__image img', '.afisha-card__venue', '.afisha-card__time', '.afisha-card__title', '.afisha-buy']) {
    assert.equal(await first.locator(selector).count(), 1, `first card exposes ${selector}`);
  }
  assert.ok((await first.locator('.afisha-card__image img').getAttribute('alt')).trim().length > 0);
  assert.match(await first.locator('.afisha-card__image img').getAttribute('src'), /^assets\//);
  const dateKeys = await page.locator('.afisha-card').evaluateAll(cards => cards.map(card => card.dataset.dateKey));
  assert.equal(await page.locator('.afisha-day-heading').count(), new Set(dateKeys).size, 'duplicate dates share one day heading');
  const noCast = page.locator('.afisha-card[data-has-cast="false"]').first();
  if (await noCast.count()) assert.equal(await noCast.locator('.afisha-cast-trigger').count(), 0);
  const noDirector = page.locator('.afisha-card[data-has-director="false"]').first();
  if (await noDirector.count()) assert.equal(await noDirector.locator('.afisha-card__director').count(), 0);
  console.log('Afisha editorial browser checks passed.');
} finally {
  await browser.close();
  await new Promise(resolve => server.close(resolve));
}
```

- [ ] **Step 2: Run the test and verify the missing-card failure**

Run:

```powershell
$env:NOVAT_PLAYWRIGHT_MODULE='C:\Users\User\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\node_modules\playwright'
& 'C:\Users\User\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' tests\afisha-editorial.browser.mjs
```

Expected: FAIL at `every source performance becomes an editorial card` because `.afisha-card` does not exist.

- [ ] **Step 3: Add the enhancement module**

Create `afisha.js` with an idempotent initializer. Extract all values before replacing card content, normalize calendar image labels by removing `в НОВАТе`, split `Сб, 19:00` into weekday and time, and insert a heading only when the `date + weekday` key changes:

```js
(() => {
  const normalize = value => value.replace(/\s+/g, ' ').trim().toLocaleLowerCase('ru-RU');
  const text = (root, selector) => root.querySelector(selector)?.textContent.replace(/\s+/g, ' ').trim() || '';
  const escapeHtml = value => value.replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);

  function imageIndex() {
    return new Map([...document.querySelectorAll('#calendar img.data-item__background')].map(image => [
      normalize((image.alt || '').replace(/\s+в НОВАТе$/i, '')),
      image.getAttribute('src')
    ]));
  }

  function readCard(card, images) {
    const title = text(card, '.poster-item__title');
    const dayTime = text(card, '.day-week.desktop-inline').split(',').map(part => part.trim());
    const month = text(card, '.number-day.desktop-inline').replace(text(card, '.date-number'), '').replace(text(card, '.day-week.desktop-inline'), '').trim();
    return {
      title,
      day: text(card, '.date-number'),
      weekday: dayTime[0] || '',
      time: dayTime[1] || '',
      month,
      venue: text(card, '.poster-item__info .info-item') || text(card, '.info-day .info-item--right'),
      age: text(card, '.age-limit'),
      director: text(card, '.actors--top .actors__item:last-child'),
      castHtml: card.querySelector('.actors--top')?.innerHTML || '',
      image: images.get(normalize(title)) || '',
      pushkin: card.querySelector('.pc_item img')?.getAttribute('src') || ''
    };
  }

  function renderCard(card, data, showHeading) {
    card.classList.add('afisha-card');
    card.dataset.title = data.title;
    card.innerHTML = `${showHeading ? `<h2 class="afisha-day-heading"><span>${escapeHtml(data.month)}, ${escapeHtml(data.weekday)}</span></h2>` : ''}
      <div class="afisha-card__grid">
        <div class="afisha-card__date"><strong>${escapeHtml(data.day)}</strong><span>${escapeHtml(data.month)}</span></div>
        <figure class="afisha-card__image"><img src="${escapeHtml(data.image)}" alt="${escapeHtml(data.title)}"></figure>
        <div class="afisha-card__main">
          <div class="afisha-card__schedule"><span class="afisha-card__venue">${escapeHtml(data.venue)}</span><span aria-hidden="true">·</span><time class="afisha-card__time">${escapeHtml(data.time)}</time></div>
          <h3 class="afisha-card__title">${escapeHtml(data.title)}</h3>
          <div class="afisha-card__actions"><a href="#" class="afisha-buy">Купить билет</a>${data.pushkin ? `<img class="afisha-pushkin" src="${escapeHtml(data.pushkin)}" alt="Пушкинская карта">` : ''}</div>
        </div>
        <aside class="afisha-card__meta">${data.director ? `<p class="afisha-card__director">${escapeHtml(data.director)}</p>` : ''}${data.castHtml ? `<button class="afisha-cast-trigger" type="button">Состав</button>` : ''}</aside>
      </div>`;
    card.dataset.hasCast = String(Boolean(data.castHtml));
    card.dataset.hasDirector = String(Boolean(data.director));
    if (data.castHtml) card.querySelector('.afisha-cast-trigger')._cast = { title: data.title, html: data.castHtml };
  }

  function init() {
    const root = document.querySelector('#list .c-list-wrap');
    if (!root || root.dataset.editorialReady) return;
    root.dataset.editorialReady = 'true';
    const images = imageIndex();
    let previous = '';
    root.querySelectorAll(':scope > .data-item').forEach(card => {
      const data = readCard(card, images);
      const key = `${data.day}|${data.weekday}`;
      renderCard(card, data, key !== previous);
      card.dataset.dateKey = key;
      previous = key;
    });
    document.dispatchEvent(new CustomEvent('afisha:ready'));
  }

  window.NovatAfisha = { init };
  document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', init) : init();
})();
```

Keep `castHtml` limited to the existing trusted local markup; every plain-text value goes through `escapeHtml` as shown above.

- [ ] **Step 4: Load the module and preserve existing preview behavior**

At the end of `index.html`, keep `preview.js` and add the new versioned script after it:

```html
<script src="preview.js?v=brand-13"></script>
<script src="afisha.js?v=brand-1"></script>
```

- [ ] **Step 5: Run the browser test and the existing regression test**

Run the browser command from Step 2, then:

```powershell
pwsh -NoProfile -File .\tests\afisha-refresh.Tests.ps1
```

Expected: both PASS.

- [ ] **Step 6: Commit**

```powershell
git add index.html afisha.js tests/afisha-editorial.browser.mjs
git commit -m "Build editorial afisha card markup"
```

### Task 2: Editorial Grid, Brand Styling, Pushkin Marker, and Image Fallback

**Files:**
- Modify: `preview.css`
- Modify: `afisha.js`
- Modify: `tests/afisha-editorial.browser.mjs`

**Interfaces:**
- Consumes: card classes and data emitted by Task 1.
- Produces: four-zone desktop grid, `1px` dividers, approved colors, ticket button states, `.is-fallback`, and responsive image geometry used by Task 4.

- [ ] **Step 1: Extend the browser test with visual contracts**

Before the final success log, add assertions that fail against unstyled cards:

```js
const visual = await page.locator('.afisha-card').first().evaluate(card => {
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

const markerCount = await page.locator('.afisha-pushkin').count();
assert.ok(markerCount > 0, 'Pushkin marker is visible for eligible cards');
```

Also force the first image to fail and assert the branded fallback:

```js
await first.locator('.afisha-card__image img').evaluate(image => {
  image.src = '/assets/missing-poster.jpg';
});
await page.waitForFunction(() => document.querySelector('.afisha-card__image')?.classList.contains('is-fallback'));
```

- [ ] **Step 2: Run the test and verify the expected CSS/fallback failures**

Run the browser command from Task 1 Step 2.

Expected: FAIL because the grid is not styled and the error handler does not add `.is-fallback`.

- [ ] **Step 3: Add the exact editorial styles**

Append focused rules to `preview.css`:

```css
.afisha-card { border-top: 1px solid var(--brand-yellow); padding: 24px 0 34px; }
.afisha-day-heading { margin: 0 0 18px; color: var(--brand-burgundy); font-size: 15px; text-transform: uppercase; }
.afisha-card__grid { display: grid; grid-template-columns: minmax(110px, .7fr) minmax(220px, 1.35fr) minmax(320px, 2.5fr) minmax(190px, 1fr); gap: 28px; align-items: start; }
.afisha-card__date { color: var(--brand-burgundy); display: flex; flex-direction: column; }
.afisha-card__date strong { color: var(--brand-burgundy); font-size: clamp(54px, 5vw, 82px); font-weight: 500; line-height: .9; }
.afisha-card__date span { margin-top: 8px; font-size: 16px; text-transform: lowercase; }
.afisha-card__image { aspect-ratio: 4 / 3; margin: 0; overflow: hidden; background: var(--brand-burgundy); }
.afisha-card__image img { width: 100%; height: 100%; object-fit: cover; display: block; }
.afisha-card__image.is-fallback::after { content: "НОВАТ"; display: grid; place-items: center; width: 100%; height: 100%; color: var(--brand-yellow); font-size: 28px; letter-spacing: .08em; }
.afisha-card__image.is-fallback img { display: none; }
.afisha-card__schedule { display: flex; gap: 8px; color: var(--brand-burgundy); font-size: 14px; text-transform: uppercase; }
.afisha-card__title { margin: 18px 0 24px; color: var(--brand-burgundy); font-size: clamp(30px, 3vw, 52px); line-height: 1; }
.afisha-card__actions { display: flex; align-items: center; gap: 16px; }
.afisha-buy { border: 1px solid var(--brand-burgundy); color: var(--brand-burgundy); padding: 11px 16px; text-transform: uppercase; }
.afisha-buy:hover, .afisha-buy:focus-visible { background: var(--brand-burgundy); color: #fff; }
.afisha-pushkin { width: 72px; height: auto; }
.afisha-card__meta { color: var(--brand-burgundy); font-size: 14px; }
.afisha-cast-trigger { border: 0; border-bottom: 1px solid var(--brand-burgundy); background: transparent; color: var(--brand-burgundy); padding: 0; text-transform: uppercase; }
```

- [ ] **Step 4: Add image error handling**

In `renderCard`, attach an error handler after inserting markup:

```js
const image = card.querySelector('.afisha-card__image img');
if (!data.image) image.closest('.afisha-card__image').classList.add('is-fallback');
image.addEventListener('error', () => image.closest('.afisha-card__image').classList.add('is-fallback'), { once: true });
```

- [ ] **Step 5: Run both test suites**

Run the browser command and `pwsh -NoProfile -File .\tests\afisha-refresh.Tests.ps1`.

Expected: PASS with no console errors.

- [ ] **Step 6: Commit**

```powershell
git add preview.css afisha.js tests/afisha-editorial.browser.mjs
git commit -m "Style editorial afisha cards"
```

### Task 3: Accessible Cast Drawer

**Files:**
- Modify: `afisha.js`
- Modify: `preview.css`
- Modify: `tests/afisha-editorial.browser.mjs`

**Interfaces:**
- Consumes: each trigger's `_cast` object `{ title: string, html: string }` from Task 1.
- Produces: `openDrawer(trigger)`, `closeDrawer()`, `.afisha-drawer`, `[aria-hidden]`, `.afisha-drawer-open`, and reliable focus restoration.

- [ ] **Step 1: Add failing drawer behavior checks**

Add before the success log:

```js
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
```

Add this focus-trap check immediately after the focus-restoration assertion:

```js
await trigger.click();
await page.locator('.afisha-drawer__close').focus();
await page.keyboard.press('Shift+Tab');
assert.equal(await drawer.evaluate(element => element.contains(document.activeElement)), true);
await page.locator('.afisha-drawer__close').click();
```

- [ ] **Step 2: Run and verify the missing-drawer failure**

Run the browser command.

Expected: FAIL because `.afisha-drawer` does not exist.

- [ ] **Step 3: Implement the drawer shell and state transitions**

Add these functions to `afisha.js` and call `createDrawer()` from `init()`:

```js
let activeTrigger = null;

function createDrawer() {
  if (document.querySelector('.afisha-drawer')) return;
  document.body.insertAdjacentHTML('beforeend', `<div class="afisha-drawer-layer" hidden>
    <button class="afisha-drawer__backdrop" type="button" aria-label="Закрыть состав"></button>
    <aside class="afisha-drawer" role="dialog" aria-modal="true" aria-hidden="true" aria-labelledby="afisha-drawer-title">
      <header class="afisha-drawer__header"><h2 id="afisha-drawer-title" class="afisha-drawer__title"></h2><button class="afisha-drawer__close" type="button" aria-label="Закрыть">×</button></header>
      <div class="afisha-drawer__content"></div>
    </aside>
  </div>`);
}

function openDrawer(trigger) {
  activeTrigger = trigger;
  const layer = document.querySelector('.afisha-drawer-layer');
  const drawer = layer.querySelector('.afisha-drawer');
  layer.hidden = false;
  drawer.setAttribute('aria-hidden', 'false');
  layer.querySelector('.afisha-drawer__title').textContent = trigger._cast.title;
  layer.querySelector('.afisha-drawer__content').innerHTML = trigger._cast.html;
  document.body.classList.add('afisha-drawer-open');
  layer.querySelector('.afisha-drawer__close').focus();
}

function closeDrawer() {
  const layer = document.querySelector('.afisha-drawer-layer');
  const drawer = layer.querySelector('.afisha-drawer');
  drawer.setAttribute('aria-hidden', 'true');
  layer.hidden = true;
  document.body.classList.remove('afisha-drawer-open');
  activeTrigger?.focus();
  activeTrigger = null;
}
```

Use one delegated click listener and this keyboard handler:

```js
document.addEventListener('click', event => {
  const trigger = event.target.closest('.afisha-cast-trigger');
  if (trigger) { openDrawer(trigger); return; }
  if (event.target.closest('.afisha-drawer__close, .afisha-drawer__backdrop')) closeDrawer();
});

document.addEventListener('keydown', event => {
  const drawer = document.querySelector('.afisha-drawer[aria-hidden="false"]');
  if (!drawer) return;
  if (event.key === 'Escape') { closeDrawer(); return; }
  if (event.key !== 'Tab') return;
  const focusable = [...drawer.querySelectorAll('button, a[href], [tabindex]:not([tabindex="-1"])')].filter(element => !element.disabled);
  const first = focusable[0];
  const last = focusable.at(-1);
  if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
  if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
});
```

Call `createDrawer()` once at the start of `init()` before enhancing cards.

- [ ] **Step 4: Style the right drawer with approved colors and 1px lines**

```css
.afisha-drawer-layer { position: fixed; inset: 0; z-index: 2000; display: flex; justify-content: flex-end; }
.afisha-drawer-layer[hidden] { display: none; }
.afisha-drawer__backdrop { position: absolute; inset: 0; border: 0; background: rgb(0 0 0 / 42%); }
.afisha-drawer { position: relative; width: min(720px, 50vw); height: 100%; overflow: auto; background: #fff; color: var(--brand-burgundy); transform: translateX(0); }
.afisha-drawer__header { position: sticky; top: 0; display: flex; justify-content: space-between; align-items: center; padding: 22px 28px; border-bottom: 1px solid var(--brand-yellow); background: #fff; }
.afisha-drawer__title { margin: 0; color: var(--brand-burgundy); }
.afisha-drawer__close { width: 42px; height: 42px; border: 1px solid var(--brand-burgundy); background: transparent; color: var(--brand-burgundy); font-size: 28px; }
.afisha-drawer__content { padding: 28px; }
.afisha-drawer__content .actors__item { padding: 12px 0; border-bottom: 1px solid var(--brand-yellow); }
.afisha-drawer-open { overflow: hidden; }
```

- [ ] **Step 5: Run both test suites**

Expected: all browser checks and the existing PowerShell regression test PASS.

- [ ] **Step 6: Commit**

```powershell
git add afisha.js preview.css tests/afisha-editorial.browser.mjs
git commit -m "Add accessible afisha cast drawer"
```

### Task 4: Responsive Layout, Sticky Regression, and Final Verification

**Files:**
- Modify: `preview.css`
- Modify: `tests/afisha-editorial.browser.mjs`
- Modify: `tests/afisha-refresh.Tests.ps1`
- Modify: `index.html:69,2958` for final cache-busting versions only.

**Interfaces:**
- Consumes: complete card and drawer interfaces from Tasks 1-3.
- Produces: tablet/mobile stacking, full-screen mobile drawer, preserved sticky month, final regression coverage, and deployable asset versions.

- [ ] **Step 1: Add failing mobile and regression checks**

Extend the browser script after desktop drawer checks:

```js
await page.setViewportSize({ width: 390, height: 844 });
await page.reload({ waitUntil: 'networkidle' });
const mobile = await page.evaluate(() => ({
  overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
  columns: getComputedStyle(document.querySelector('.afisha-card__grid')).gridTemplateColumns,
  monthPosition: getComputedStyle(document.querySelector('.c-list-wrap > .month')).position,
  order: ['.afisha-card__date', '.afisha-card__image', '.afisha-card__main', '.afisha-card__meta'].map(selector => Math.round(document.querySelector(`.afisha-card ${selector}`).getBoundingClientRect().top))
}));
assert.equal(mobile.overflow, 0);
assert.equal(mobile.columns.split(' ').length, 1);
assert.equal(mobile.monthPosition, 'sticky');
assert.deepEqual(mobile.order, [...mobile.order].sort((a, b) => a - b));
await page.locator('.afisha-cast-trigger').first().click();
const drawerWidth = await page.locator('.afisha-drawer').evaluate(element => Math.round(element.getBoundingClientRect().width));
assert.equal(drawerWidth, 390);
```

In `tests/afisha-refresh.Tests.ps1`, require the new script include and exact brand contracts:

```powershell
if ($html -notmatch 'afisha\.js\?v=brand-') {
    $failures.Add('Editorial afisha module is not loaded')
}
foreach ($pattern in @(
    '(?s)\.afisha-card\s*\{[^}]*border-top:\s*1px\s+solid\s+var\(--brand-yellow\)',
    '(?s)\.afisha-buy\s*\{[^}]*border:\s*1px\s+solid\s+var\(--brand-burgundy\)',
    '(?s)\.afisha-drawer__header\s*\{[^}]*border-bottom:\s*1px\s+solid\s+var\(--brand-yellow\)'
)) {
    if ($css -notmatch $pattern) { $failures.Add("Missing editorial afisha rule: $pattern") }
}
```

- [ ] **Step 2: Run tests and verify responsive failures**

Expected: browser test FAILS on mobile columns and drawer width; PowerShell test may fail until final CSS and script versions are present.

- [ ] **Step 3: Add tablet and mobile styles**

```css
@media (max-width: 1180px) {
  .afisha-card__grid { grid-template-columns: 100px minmax(200px, 1fr) minmax(280px, 1.6fr); }
  .afisha-card__meta { grid-column: 3; }
}
@media (max-width: 767px) {
  .afisha-card { padding: 20px 0 28px; }
  .afisha-card__grid { grid-template-columns: minmax(0, 1fr); gap: 16px; }
  .afisha-card__date, .afisha-card__main, .afisha-card__meta { grid-column: 1; }
  .afisha-card__date strong { font-size: 54px; }
  .afisha-card__image { width: 100%; }
  .afisha-card__title { font-size: 32px; }
  .afisha-drawer { width: 100vw; }
}
```

Neutralize only the list item's legacy spacing while leaving calendar cells untouched:

```css
#list .afisha-card.data-item { margin: 0; min-height: 0; background: #fff; }
#list .afisha-card::before, #list .afisha-card::after { content: none; }
```

- [ ] **Step 4: Run the full automated verification**

Run:

```powershell
pwsh -NoProfile -File .\tests\afisha-refresh.Tests.ps1
$env:NOVAT_PLAYWRIGHT_MODULE='C:\Users\User\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\node_modules\playwright'
& 'C:\Users\User\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' tests\afisha-editorial.browser.mjs
git diff --check
```

Expected: all commands exit `0`; browser output says `Afisha editorial browser checks passed.`

- [ ] **Step 5: Perform visual verification at three widths**

Capture screenshots at `1600×1000`, `1024×900`, and `390×844`. Confirm:

- every divider is visually `1px`;
- date, image, venue/time, title, CTA, Pushkin marker, and meta order match the approved design;
- existing sidebar and brand colors are unchanged;
- duplicate dates group correctly;
- cast drawer does not cover content after close;
- no broken images or horizontal scrollbar appear.

- [ ] **Step 6: Update cache-busting versions and rerun tests**

Increment `preview.css`, `afisha.js`, and `preview.js` query versions in `index.html`, then rerun Step 4 to verify the deployed page will fetch the new assets.

- [ ] **Step 7: Commit**

```powershell
git add index.html preview.css afisha.js tests/afisha-refresh.Tests.ps1 tests/afisha-editorial.browser.mjs
git commit -m "Finish responsive afisha redesign"
```

- [ ] **Step 8: Push and verify GitHub Pages**

```powershell
git push origin desktop-preview
```

Open `https://kcska18051-crypto.github.io/novat-desktop-preview/?v=editorial-1` at desktop and mobile widths and repeat the critical screenshot assertions from Step 5.
