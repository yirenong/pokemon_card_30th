(function () {
  const ids = ['shawn','yongtai','sam','yiren'];
  let id;
  try { id = localStorage.getItem('thirty-login-id'); } catch {}
  window.ThirtyLoginId = ids.includes(id) ? id : null;
  function mount() {
    const bar = document.createElement('div');
    bar.className = 'login-bar';
    if (window.ThirtyLoginId) {
      bar.append('Logged in as ' + window.ThirtyLoginId + ' ? ');
      const button = document.createElement('button'); button.textContent = 'Switch account';
      button.onclick = () => { try {localStorage.removeItem('thirty-login-id')} catch {} location.reload(); };
      bar.append(button); document.body.prepend(bar); return;
    }
    const dialog = document.createElement('dialog');
    dialog.setAttribute('aria-labelledby','loginTitle');
    dialog.innerHTML = '<form><h2 id="loginTitle">Your collection</h2><p>Choose your name, then log in. No password needed.</p><label for="loginId">Login ID</label><input id="loginId" name="loginId" autocomplete="username" autocapitalize="none" required><p id="loginError" role="alert"></p><button type="submit">Log in</button><div class="login-names" role="group" aria-label="Choose your login ID"></div><small>Anyone with a login ID can access that collection.</small></form>';
    for (const name of ids) {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = name;
      button.onclick = () => {
        dialog.querySelector('input').value = name;
        dialog.querySelector('#loginError').textContent = '';
        for (const choice of dialog.querySelectorAll('.login-names button')) choice.setAttribute('aria-pressed', String(choice === button));
        dialog.querySelector('button[type="submit"]').focus();
      };
      button.setAttribute('aria-pressed', 'false');
      dialog.querySelector('.login-names').append(button);
    }
    dialog.addEventListener('cancel',event=>event.preventDefault());
    dialog.querySelector('form').onsubmit = event => {
      event.preventDefault(); const value = dialog.querySelector('input').value.trim().toLowerCase();
      if (!ids.includes(value)) {dialog.querySelector('#loginError').textContent='Please enter one of the four login IDs.'; return;}
      try {localStorage.setItem('thirty-login-id',value); location.reload();} catch {dialog.querySelector('#loginError').textContent='Enable browser storage to remember your login.';}
    };
    document.body.append(dialog); dialog.showModal();
  }
  mount();
})();
