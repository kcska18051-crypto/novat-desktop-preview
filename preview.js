document.addEventListener('click',function(e){const a=e.target.closest('a');if(a)e.preventDefault();const t=e.target.closest('[data-toggle="collapse"]');if(t){const d=document.querySelector(t.getAttribute('href')||'#collapseExample');if(d){const open=d.classList.toggle('in');d.style.display=open?'block':'none';t.setAttribute('aria-expanded',String(open));}}},true);document.addEventListener('submit',function(e){e.preventDefault()},true);
(function () {
 const button = document.getElementById('background-toggle');
 if (!button) return;
 button.addEventListener('click', function () {
  const white = document.documentElement.dataset.previewBackground !== 'white';
  document.documentElement.dataset.previewBackground = white ? 'white' : 'beige';
  button.textContent = white ? 'Бежевый фон' : 'Белый фон';
  button.setAttribute('aria-pressed', String(white));
 });
})();
