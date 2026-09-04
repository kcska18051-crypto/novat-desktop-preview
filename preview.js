document.addEventListener('click',function(e){const a=e.target.closest('a');if(a)e.preventDefault();const t=e.target.closest('[data-toggle="collapse"]');if(t){const d=document.querySelector(t.getAttribute('href')||'#collapseExample');if(d){const open=d.classList.toggle('in');d.style.display=open?'block':'none';t.setAttribute('aria-expanded',String(open));}}},true);document.addEventListener('submit',function(e){e.preventDefault()},true);

(function () {
 const root = document.documentElement;
 const backgroundButton = document.getElementById('background-toggle');
 const designButton = document.getElementById('design-toggle');
 const backgrounds = { original: 'beige', refined: 'white' };
 let design = 'original';
 function render() {
  root.dataset.previewDesign = design;
  root.dataset.previewBackground = backgrounds[design];
  backgroundButton.textContent = backgrounds[design] === 'white' ? 'Бежевый фон' : 'Белый фон';
  backgroundButton.setAttribute('aria-pressed', String(backgrounds[design] === 'white'));
  designButton.textContent = design === 'refined' ? 'Вернуть текущий вариант' : 'Авторский вариант';
  designButton.setAttribute('aria-pressed', String(design === 'refined'));
 }
 backgroundButton.addEventListener('click', function () {
  backgrounds[design] = backgrounds[design] === 'white' ? 'beige' : 'white'; render();
 });
 designButton.addEventListener('click', function () {
  design = design === 'original' ? 'refined' : 'original'; render();
 });
 render();
})();
