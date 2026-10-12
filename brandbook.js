const menu = document.querySelector('#brandbook-menu');
const toggle = document.querySelector('.brandbook-menu-toggle');
toggle.addEventListener('click', () => {
  menu.showModal();
  toggle.setAttribute('aria-expanded', 'true');
  document.documentElement.style.overflow = 'hidden';
});
menu.querySelector('.brandbook-menu-close').addEventListener('click', () => menu.close());
menu.addEventListener('close', () => {
  toggle.setAttribute('aria-expanded', 'false');
  document.documentElement.style.overflow = '';
  toggle.focus({preventScroll: true});
});
matchMedia('(min-width: 768px)').addEventListener('change', event => {
  if (event.matches && menu.open) menu.close();
});
document.querySelector('.aside-part').addEventListener('click', event => {
  if (event.target.closest('a[href="#"], button')) event.preventDefault();
});
document.querySelector('#subscribe-form').addEventListener('submit', event => event.preventDefault());
