(() => {
  let activeTrigger = null;
  const normalize = value => value.replace(/\s+/g, ' ').trim().toLocaleLowerCase('ru-RU');
  const text = (root, selector) => root.querySelector(selector)?.textContent.replace(/\s+/g, ' ').trim() || '';
  const escapeHtml = value => value.replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
  const monthHeading = month => ({
    января: 'январь', февраля: 'февраль', марта: 'март', апреля: 'апрель', мая: 'май', июня: 'июнь',
    июля: 'июль', августа: 'август', сентября: 'сентябрь', октября: 'октябрь', ноября: 'ноябрь', декабря: 'декабрь'
  })[normalize(month)] || month;

  function imageIndex() {
    return new Map([...document.querySelectorAll('#calendar img.data-item__background')].map(image => [
      normalize((image.alt || '').replace(/\s+в НОВАТе$/i, '')),
      image.getAttribute('src')
    ]));
  }

  function readCard(card, images) {
    const title = text(card, '.poster-item__title');
    const dayTime = text(card, '.day-week.desktop-inline').split(',').map(part => part.trim());
    const fullDate = text(card, '.number-day.desktop-inline');
    const day = text(card, '.date-number');
    const month = fullDate.replace(day, '').replace(text(card, '.day-week.desktop-inline'), '').trim();
    const cast = card.querySelector('.actors--top');
    const description = card.querySelector('.poster-item__description .actors:not(.actors--top)')?.cloneNode(true);
    description?.querySelectorAll('br').forEach(lineBreak => lineBreak.replaceWith('\n'));
    const director = [...(cast?.querySelectorAll('.actors__item') || [])]
      .map(item => item.textContent.replace(/\s+/g, ' ').trim())
      .find(value => /режисс|дириж/i.test(value)) || '';

    return {
      title,
      description: description?.textContent.split('\n').map(line => line.replace(/\s+/g, ' ').trim()).filter(Boolean).join('\n') || '',
      day,
      weekday: dayTime[0] || '',
      time: dayTime[1] || '',
      month,
      venue: text(card, '.poster-item__info .info-item') || text(card, '.info-day .info-item--right'),
      age: text(card, '.age-limit'),
      director,
      castHtml: cast?.innerHTML || '',
      image: images.get(normalize(title)) || '',
      pushkin: card.querySelector('.pc_item img')?.getAttribute('src') || ''
    };
  }

  function renderCard(card, data) {
    card.classList.add('afisha-card');
    card.dataset.title = data.title;
    card.dataset.dayLabel = `${monthHeading(data.month)}, ${data.weekday}`;
    card.innerHTML = `
      <div class="afisha-card__grid">
        <div class="afisha-card__date" aria-label="${escapeHtml(data.day + ' ' + data.month)}"><strong>${escapeHtml(data.day)}</strong></div>
        <figure class="afisha-card__image"><img src="${escapeHtml(data.image)}" alt="${escapeHtml(data.title)}"></figure>
        <div class="afisha-card__main">
          <div class="afisha-card__schedule"><span class="afisha-card__venue">${escapeHtml(data.venue)}</span><span aria-hidden="true">·</span><time class="afisha-card__time">${escapeHtml(data.time)}</time>${data.age ? `<span class="afisha-card__age"><span aria-hidden="true">·</span> ${escapeHtml(data.age)}</span>` : ''}</div>
          <h3 class="afisha-card__title">${escapeHtml(data.title)}</h3>
          ${data.description ? `<p class="afisha-card__description">${escapeHtml(data.description)}</p>` : ''}
          <div class="afisha-card__actions"><a href="#" class="afisha-buy">Купить билет</a>${data.pushkin ? `<img class="afisha-pushkin" src="${escapeHtml(data.pushkin)}" alt="Пушкинская карта">` : ''}</div>
        </div>
        <aside class="afisha-card__meta">${data.director ? `<p class="afisha-card__director">${escapeHtml(data.director)}</p>` : ''}${data.castHtml ? `<button class="afisha-cast-trigger" type="button">Состав</button>` : ''}</aside>
      </div>`;
    card.dataset.hasCast = String(Boolean(data.castHtml));
    card.dataset.hasDirector = String(Boolean(data.director));
    if (data.castHtml) card.querySelector('.afisha-cast-trigger')._cast = { title: data.title, html: data.castHtml };
    const image = card.querySelector('.afisha-card__image img');
    if (!data.image) image.closest('.afisha-card__image').classList.add('is-fallback');
    image.addEventListener('error', () => image.closest('.afisha-card__image').classList.add('is-fallback'), { once: true });
  }

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
    document.documentElement.classList.add('afisha-drawer-open');
    layer.querySelector('.afisha-drawer__close').focus({ preventScroll: true });
  }

  function closeDrawer() {
    const layer = document.querySelector('.afisha-drawer-layer');
    const drawer = layer.querySelector('.afisha-drawer');
    drawer.setAttribute('aria-hidden', 'true');
    layer.hidden = true;
    document.body.classList.remove('afisha-drawer-open');
    document.documentElement.classList.remove('afisha-drawer-open');
    activeTrigger?.focus({ preventScroll: true });
    activeTrigger = null;
  }

  function createMobileHeader() {
    if (document.querySelector('.novat-mobile-header')) return;
    const logo = document.querySelector('.aside-part .logo img').getAttribute('src');
    const navigation = document.querySelector('.aside-part .navigation').innerHTML;
    document.body.insertAdjacentHTML('afterbegin', `<header class="novat-mobile-header">
      <button class="novat-mobile-toggle" type="button" aria-label="Открыть меню" aria-controls="novat-mobile-menu" aria-expanded="false"><span></span><span></span><span></span></button>
      <a class="novat-mobile-logo" href="#" aria-label="НОВАТ — главная"><img src="${escapeHtml(logo)}" alt="НОВАТ"></a>
    </header>
    <dialog id="novat-mobile-menu" class="novat-mobile-menu" aria-label="Меню НОВАТа">
      <div class="novat-mobile-menu__top"><span>НОВАТ</span><button type="button" class="novat-mobile-close" aria-label="Закрыть меню">×</button></div>
      <a class="novat-mobile-account" href="#">Личный кабинет</a>
      <nav aria-label="Основная навигация">${navigation}</nav>
      <p class="novat-mobile-slogan">ВЕЛИКИЙ ТЕАТР ПОБЕДЫ</p>
    </dialog>`);
    const toggle = document.querySelector('.novat-mobile-toggle');
    const menu = document.querySelector('#novat-mobile-menu');
    toggle.addEventListener('click', () => {
      menu.showModal();
      document.documentElement.classList.add('afisha-drawer-open');
      toggle.setAttribute('aria-expanded', 'true');
    });
    menu.querySelector('.novat-mobile-close').addEventListener('click', () => menu.close());
    menu.addEventListener('close', () => {
      document.documentElement.classList.remove('afisha-drawer-open');
      toggle.setAttribute('aria-expanded', 'false');
      toggle.focus({ preventScroll: true });
    });
    matchMedia('(max-width: 767px)').addEventListener('change', event => {
      if (!event.matches && menu.open) menu.close();
    });
    document.querySelector('.archive-wrapper').insertAdjacentHTML('beforebegin', '<h1 class="novat-mobile-title">Афиша</h1>');
    const filterToggle = document.querySelector('[aria-controls="collapseExample"]');
    const filter = document.querySelector('#collapseExample');
    const updateFilter = () => {
      const expanded = filter.classList.contains('in');
      filterToggle.setAttribute('aria-expanded', String(expanded));
      filterToggle.querySelector('.c-filter-text').style.display = expanded ? 'none' : '';
      filterToggle.querySelector('.c-filter-text-hide').style.display = expanded ? '' : 'none';
    };
    if (matchMedia('(max-width: 767px)').matches) filter.classList.remove('in');
    filterToggle.setAttribute('role', 'button');
    filterToggle.tabIndex = 0;
    filterToggle.addEventListener('click', updateFilter);
    filterToggle.addEventListener('keydown', event => {
      if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); filterToggle.click(); }
    });
    updateFilter();
  }

  function init() {
    createDrawer();
    createMobileHeader();
    const archive = document.querySelector('.archive-wrapper');
    if (!archive.querySelector('.background-toggle')) {
      const toggle = document.createElement('button');
      toggle.type = 'button';
      toggle.className = 'background-toggle';
      toggle.textContent = 'Бежевый фон';
      toggle.addEventListener('click', () => {
        const beige = document.documentElement.dataset.background !== 'beige';
        document.documentElement.dataset.background = beige ? 'beige' : 'white';
        toggle.textContent = beige ? 'Белый фон' : 'Бежевый фон';
      });
      archive.append(toggle);
    }
    const root = document.querySelector('#list .c-list-wrap');
    if (!root || root.dataset.editorialReady) return;
    root.dataset.editorialReady = 'true';
    const images = imageIndex();
    root.querySelectorAll(':scope > .data-item').forEach(card => {
      const data = readCard(card, images);
      const key = `${data.day}|${data.weekday}`;
      renderCard(card, data);
      card.dataset.dateKey = key;
    });
    const heading = root.querySelector(':scope > .month');
    const content = document.querySelector('.main-content');
    const sizeMonthStrip = () => {
      const bounds = content.getBoundingClientRect();
      heading.style.setProperty('--month-strip-left', `${bounds.left - heading.getBoundingClientRect().left}px`);
      heading.style.setProperty('--month-strip-width', `${bounds.width}px`);
    };
    new ResizeObserver(sizeMonthStrip).observe(content);
    sizeMonthStrip();
    const cards = [...root.querySelectorAll(':scope > .afisha-card')];
    heading.setAttribute('role', 'heading');
    heading.setAttribute('aria-level', '2');
    const updateHeading = () => {
      const edge = heading.getBoundingClientRect().bottom;
      let current = cards[0];
      for (const card of cards) {
        if (card.getBoundingClientRect().top > edge + 1) break;
        current = card;
      }
      if (current && heading.textContent !== current.dataset.dayLabel) heading.textContent = current.dataset.dayLabel;
    };
    let scheduled = false;
    const scheduleHeading = () => {
      if (scheduled) return;
      scheduled = true;
      requestAnimationFrame(() => { scheduled = false; updateHeading(); });
    };
    window.addEventListener('scroll', scheduleHeading, { passive: true });
    window.addEventListener('resize', scheduleHeading);
    window.addEventListener('load', updateHeading);
    updateHeading();
    document.dispatchEvent(new CustomEvent('afisha:ready'));
  }

  window.NovatAfisha = { init };
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
  document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', init) : init();
})();
