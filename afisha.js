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
    const fullDate = text(card, '.number-day.desktop-inline');
    const day = text(card, '.date-number');
    const month = fullDate.replace(day, '').replace(text(card, '.day-week.desktop-inline'), '').trim();
    const cast = card.querySelector('.actors--top');
    const director = [...(cast?.querySelectorAll('.actors__item') || [])]
      .map(item => item.textContent.replace(/\s+/g, ' ').trim())
      .find(value => /режисс|дириж/i.test(value)) || '';

    return {
      title,
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

  function renderCard(card, data, showHeading) {
    card.classList.add('afisha-card');
    card.dataset.title = data.title;
    card.innerHTML = `${showHeading ? `<h2 class="afisha-day-heading"><span>${escapeHtml(data.month)}, ${escapeHtml(data.weekday)}</span></h2>` : ''}
      <div class="afisha-card__grid">
        <div class="afisha-card__date"><strong>${escapeHtml(data.day)}</strong><span>${escapeHtml(data.month)}</span></div>
        <figure class="afisha-card__image"><img src="${escapeHtml(data.image)}" alt="${escapeHtml(data.title)}"></figure>
        <div class="afisha-card__main">
          <div class="afisha-card__schedule"><span class="afisha-card__venue">${escapeHtml(data.venue)}</span><span aria-hidden="true">·</span><time class="afisha-card__time">${escapeHtml(data.time)}</time></div>
          <h3 class="afisha-card__title">${escapeHtml(data.title)}${data.age ? ` <span class="afisha-card__age">${escapeHtml(data.age)}</span>` : ''}</h3>
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
