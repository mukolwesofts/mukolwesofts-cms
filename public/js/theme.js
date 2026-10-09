// Loaded synchronously in <head>: sets data-theme before first paint so the
// correct theme renders with no flash. Default follows the system setting.
(function () {
  var stored = null;
  try {
    stored = localStorage.getItem('theme');
  } catch (e) {
    /* private mode etc. */
  }
  var theme =
    stored === 'light' || stored === 'dark'
      ? stored
      : window.matchMedia('(prefers-color-scheme: light)').matches
        ? 'light'
        : 'dark';
  document.documentElement.dataset.theme = theme;

  function updateLabel(btn) {
    var current = document.documentElement.dataset.theme;
    var next = current === 'light' ? 'dark' : 'light';
    btn.textContent = next;
    btn.setAttribute('aria-label', 'Switch to ' + next + ' mode');
  }

  document.addEventListener('DOMContentLoaded', function () {
    var btn = document.getElementById('theme-toggle');
    if (!btn) return;
    updateLabel(btn);
    btn.addEventListener('click', function () {
      var next = document.documentElement.dataset.theme === 'light' ? 'dark' : 'light';
      document.documentElement.dataset.theme = next;
      try {
        localStorage.setItem('theme', next);
      } catch (e) {
        /* ignore */
      }
      updateLabel(btn);
    });
  });
})();
