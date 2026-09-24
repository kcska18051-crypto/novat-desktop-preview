// Client preview: preserve hover/focus styling without navigating or switching views.
document.addEventListener('click', event => {
  if (event.target.closest('a, button, input[type="submit"]')) event.preventDefault();
}, true);
document.addEventListener('submit', event => event.preventDefault(), true);
