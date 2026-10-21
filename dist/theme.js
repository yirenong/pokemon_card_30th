(() => {
  const key = 'thirty-theme';
  const valid = value => ['original', 'yellow', 'dark'].includes(value);
  function apply(value) {
    document.documentElement.dataset.theme = value;
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.content = {original: '#f5f3e9', yellow: '#fff9dc', dark: '#171a20'}[value];
  }
  let theme = 'original';
  try { const saved = localStorage.getItem(key); if (valid(saved)) theme = saved; } catch {}
  apply(theme);
  document.addEventListener('DOMContentLoaded', () => {
    const picker = document.querySelector('#themeSelect');
    picker.value = theme;
    picker.addEventListener('change', () => {
      if (!valid(picker.value)) return;
      theme = picker.value;
      apply(theme);
      try { localStorage.setItem(key, theme); } catch {}
    });
    window.addEventListener('storage', event => {
      if (event.key !== key) return;
      theme = valid(event.newValue) ? event.newValue : 'original';
      apply(theme);
      picker.value = theme;
    });
  });
})();
