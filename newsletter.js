(() => {
  const init = () => {
  const triggerMarkup = '<button class="newsletter-trigger" type="button" aria-haspopup="dialog" aria-controls="newsletter-dialog"><span>Подписаться на рассылки</span><svg viewBox="0 0 20 20" aria-hidden="true"><path d="M2 10h15m-6-6 6 6-6 6"/></svg></button>';
  const subscription = document.querySelector('.aside-part .subscribe');
  if (subscription) subscription.innerHTML = triggerMarkup;
  for (const menu of document.querySelectorAll('#novat-mobile-menu, #brandbook-menu')) {
    menu.querySelector('nav')?.insertAdjacentHTML('afterend', triggerMarkup);
  }
  const content = document.querySelector('.main-content .wrap, .brandbook-wrap');
  if (content) {
    const entry = document.createElement('section');
    entry.className = 'newsletter-mobile-entry';
    entry.setAttribute('aria-label', 'Подписка на рассылки');
    entry.innerHTML = triggerMarkup;
    const footer = content.querySelector('.footer, .brandbook-footer');
    if (footer) footer.before(entry); else content.append(entry);
  }
  document.body.insertAdjacentHTML('beforeend', `<dialog id="newsletter-dialog" class="newsletter-dialog" aria-labelledby="newsletter-title">
    <div class="newsletter-dialog__inner">
      <header class="newsletter-dialog__header"><h2 id="newsletter-title" class="newsletter-dialog__title">Подписаться на рассылки</h2><button class="newsletter-dialog__close" type="button" aria-label="Закрыть подписку"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m4 4 16 16M20 4 4 20"/></svg></button></header>
      <p class="newsletter-dialog__description">Премьеры, события и начало продаж билетов —<br>в вашей почте.</p>
      <form class="newsletter-dialog__form">
        <label class="newsletter-dialog__label" for="newsletter-email">Ваш e-mail</label>
        <input class="newsletter-dialog__email" id="newsletter-email" name="email" type="email" autocomplete="email" inputmode="email" placeholder="name@example.ru" required>
        <label class="newsletter-dialog__consent"><input type="checkbox" name="consent" required><span>Согласен на <a href="https://novat.ru/theatre/theatre/#doc" target="_blank" rel="noopener">обработку персональных данных</a> и получение рассылок</span></label>
        <button class="newsletter-dialog__submit" type="submit">Подписаться</button>
        <p class="newsletter-dialog__note">Отписаться можно в любом письме.</p>
        <p class="newsletter-dialog__status" role="status" hidden></p>
      </form>
    </div>
  </dialog>`);
  const dialog = document.querySelector('#newsletter-dialog');
  let opener, previousOverflow;
  document.addEventListener('click', event => {
    const trigger = event.target.closest('.newsletter-trigger');
    if (!trigger) return;
    opener = trigger;
    previousOverflow = document.documentElement.style.overflow;
    dialog.querySelector('.newsletter-dialog__status').hidden = true;
    dialog.showModal();
    document.documentElement.style.overflow = 'hidden';
    dialog.querySelector('.newsletter-dialog__close').focus({preventScroll: true});
  });
  dialog.querySelector('.newsletter-dialog__close').addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', event => {
    if (event.target !== dialog) return;
    const bounds = dialog.getBoundingClientRect();
    if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) dialog.close();
  });
  dialog.addEventListener('close', () => {
    document.documentElement.style.overflow = previousOverflow;
    opener?.focus({preventScroll: true});
  });
  dialog.querySelector('form').addEventListener('submit', event => {
    event.preventDefault();
    const status = dialog.querySelector('.newsletter-dialog__status');
    status.textContent = 'В режиме просмотра подписка не оформляется.';
    status.hidden = false;
  });
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, {once: true});
  else init();
})();
