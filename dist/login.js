(function () {
  const ids = ['shawn','yongtai','sam','yiren'];
  let id;
  try { id = localStorage.getItem('thirty-login-id'); } catch {}
  window.ThirtyLoginId = typeof id === 'string' && /^[a-z0-9][a-z0-9_-]{2,23}$/.test(id) ? id : null;
  function mount() {
    const bar = document.createElement('div');
    bar.className = 'login-bar';
    if (window.ThirtyLoginId) {
      const profile = document.createElement('span'); profile.className = 'login-profile'; profile.textContent = window.ThirtyLoginId; bar.append(profile);
      const button = document.createElement('button'); button.textContent = 'Switch account';
      button.onclick = () => { try {localStorage.removeItem('thirty-login-id')} catch {} location.reload(); };
      bar.append(button); document.body.prepend(bar); return;
    }
    const dialog = document.createElement('dialog');
    dialog.className = 'login-dialog';
    dialog.setAttribute('aria-labelledby','loginTitle');
    dialog.setAttribute('aria-describedby','loginDescription');
    dialog.innerHTML = '<form><div class="login-brand"><span class="ball" aria-hidden="true"></span> THIRTY <span>COLLECTION TRACKER</span></div><p class="eyebrow login-eyebrow">A LITTLE CLOSER TO COMPLETE</p><h2 id="loginTitle">Your cards.<br><em>Your collection.</em></h2><p id="loginDescription">Choose your collector profile to pick up where you left off.</p><label class="login-id-label" for="loginId">Login ID</label><input id="loginId" name="loginId" type="text" autocomplete="username" autocapitalize="none" spellcheck="false" minlength="3" maxlength="24" pattern="[a-zA-Z0-9][a-zA-Z0-9_-]{2,23}" placeholder="Enter your login ID" required aria-describedby="loginHint"><small id="loginHint">3?24 letters, numbers, underscores or hyphens.</small><div class="login-names" role="group" aria-label="Choose your collector profile"></div><p id="loginError" role="alert"></p><button class="login-submit" type="submit" disabled>Open my collection <span aria-hidden="true">&#8594;</span></button><button class="login-toggle" type="button">New collector? Register a login</button><p class="login-note">No password needed. Your checklist saves across devices.</p><small class="login-privacy">Profiles are shared: anyone who chooses your name can access your collection.</small></form>';
    for (const name of ids) {
      const button = document.createElement('button');
      button.type = 'button';
      button.innerHTML = '<span class="login-avatar" aria-hidden="true">' + name[0].toUpperCase() + '</span><span class="login-name">' + name + '</span><span class="login-choice-mark" aria-hidden="true"></span>';
      button.onclick = () => {
        dialog.querySelector('input').value = name;
        dialog.querySelector('#loginError').textContent = '';
        for (const choice of dialog.querySelectorAll('.login-names button')) choice.setAttribute('aria-pressed', String(choice === button));
        dialog.querySelector('button[type="submit"]').disabled = false;
      };
      button.setAttribute('aria-pressed', 'false');
      dialog.querySelector('.login-names').append(button);
    }
    dialog.addEventListener('cancel',event=>event.preventDefault());
    let registering = false, busy = false;
    const input = dialog.querySelector('#loginId'), submit = dialog.querySelector('.login-submit'), toggle = dialog.querySelector('.login-toggle'), error = dialog.querySelector('#loginError');
    input.addEventListener('input', () => {
      submit.disabled = busy || !input.value.trim(); error.textContent = '';
      for (const choice of dialog.querySelectorAll('.login-names button')) choice.setAttribute('aria-pressed', String(choice.querySelector('.login-name').textContent === input.value.trim().toLowerCase()));
    });
    toggle.onclick = () => {
      registering = !registering; error.textContent = ''; input.value = ''; submit.disabled = true;
      dialog.querySelector('.login-names').hidden = registering;
      dialog.querySelector('#loginTitle').innerHTML = registering ? 'Start your<br><em>collection.</em>' : 'Your cards.<br><em>Your collection.</em>';
      dialog.querySelector('#loginDescription').textContent = registering ? 'Choose a unique login ID for your own collection.' : 'Choose a collector profile or enter your login ID.';
      submit.innerHTML = (registering ? 'Create my login' : 'Open my collection') + ' <span aria-hidden="true">&#8594;</span>';
      toggle.textContent = registering ? 'Already registered? Back to login' : 'New collector? Register a login';
      for (const choice of dialog.querySelectorAll('.login-names button')) choice.setAttribute('aria-pressed','false');
      input.focus();
    };
    dialog.querySelector('form').onsubmit = async event => {
      event.preventDefault(); if (busy) return;
      const value = input.value.trim().toLowerCase();
      if (!/^[a-z0-9][a-z0-9_-]{2,23}$/.test(value)) {error.textContent='Use 3?24 letters, numbers, underscores or hyphens.'; return;}
      try {localStorage.setItem('thirty-storage-check','1'); localStorage.removeItem('thirty-storage-check')} catch {error.textContent='Enable browser storage to remember your login.'; return;}
      busy = true; submit.disabled = true; toggle.disabled = true; input.disabled = true;
      for (const choice of dialog.querySelectorAll('.login-names button')) choice.disabled = true;
      error.textContent = registering ? 'Creating your collection?' : 'Opening your collection?';
      try {
        const response = await fetch('/api/collection', {method:registering ? 'POST' : 'GET', headers:{'X-Login-Id':value,...(registering ? {'Content-Type':'application/json'} : {})}, ...(registering ? {body:JSON.stringify({action:'register'})} : {}), cache:'no-store', signal:AbortSignal.timeout(20000)});
        if (!response.ok) throw Error(response.status === 409 ? 'That login ID is already taken. Choose another or log in.' : response.status === 404 ? 'Login ID not found. Register it to start a collection.' : 'Unable to connect. Please try again.');
        const data = await response.json();
        if (data.loginId !== value) throw Error('Login service needs updating. Please try again later.');
        localStorage.setItem('thirty-login-id',value); location.reload();
      } catch (failure) {error.textContent = failure.message || 'Unable to connect. Please try again.';}
      finally {busy = false; submit.disabled = false; toggle.disabled = false; input.disabled = false; for (const choice of dialog.querySelectorAll('.login-names button')) choice.disabled = false;}
    };
    document.body.append(dialog); dialog.showModal();
  }
  mount();
})();
