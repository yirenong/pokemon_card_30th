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

;
﻿/* Market data is fetched at runtime. No prices or FX rates are embedded here. */
(function(root) {
  const API = 'https://openapi.tcgtracking.com/v1/3/sets/';
  const FX_API = 'https://api.frankfurter.dev/v2/rate/USD/SGD';
  const CACHE_KEY = 'thirty-market-cache-v1';
  const INTERVAL = 15 * 60 * 1000;
  const validPrice = n => typeof n === 'number' && Number.isFinite(n) && n >= 0;
  const validDate = value => typeof value === 'string' && Number.isFinite(Date.parse(value));
  function parseFeed(data, setId) {
    if (data?.set_id !== setId || !validDate(data.updated) || !data.prices || typeof data.prices !== 'object') throw Error('Invalid pricing response');
    const prices = {};
    for (const [id, entry] of Object.entries(data.prices)) {
      const market = entry?.tcg?.Holofoil?.market;
      if (/^\d+$/.test(id) && validPrice(market)) prices[id] = market;
    }
    return {setId, updated: data.updated, prices};
  }
  function parseFx(data) {
    if (data?.base !== 'USD' || data?.quote !== 'SGD' || !validPrice(data.rate) || data.rate <= 0 || !/^\d{4}-\d{2}-\d{2}$/.test(data.date) || !validDate(data.date)) throw Error('Invalid FX response');
    return {rate: data.rate, date: data.date};
  }
  function quote(card, feeds) {
    const mapping = card.pricing;
    if (!mapping || mapping.variant !== 'Holofoil') return null;
    const feed = feeds[mapping.setId];
    const value = feed?.prices?.[mapping.productId];
    return validPrice(value) ? {usd:value, updated:feed.updated, productId:mapping.productId, variant:mapping.variant} : null;
  }
  function summarize(cards, isOwned, feeds) {
    const totals = {owned:0, missing:0, all:0, ownedCount:0, missingCount:0, priced:0, unpricedOwned:0, unpricedMissing:0};
    for (const card of cards) {
      const owned = isOwned(card.id);
      const price = quote(card, feeds);
      if (!price) {totals[owned ? 'unpricedOwned' : 'unpricedMissing']++; continue}
      totals.all += price.usd;
      totals[owned ? 'owned' : 'missing'] += price.usd;
      totals[owned ? 'ownedCount' : 'missingCount']++;
      totals.priced++;
    }
    return totals;
  }
  function format(usd, currency, fx) {
    if (!validPrice(usd) || (currency === 'SGD' && (!fx || !validPrice(fx.rate) || fx.rate <= 0))) return '—';
    return new Intl.NumberFormat('en-SG', {style:'currency', currency, currencyDisplay:'code', minimumFractionDigits:2, maximumFractionDigits:2}).format(usd * (currency === 'SGD' ? fx.rate : 1));
  }
  function validateCache(data) {
    if (data?.version !== 1) return null;
    const feeds = {};
    for (const setId of [24722,24837]) {
      const feed = data.feeds?.[setId];
      if (!feed || feed.setId !== setId || !validDate(feed.updated) || !feed.prices || !validDate(feed.checkedAt)) continue;
      const prices = {};
      for (const [id,value] of Object.entries(feed.prices)) if (/^\d+$/.test(id) && validPrice(value)) prices[id] = value;
      feeds[setId] = {...feed, prices};
    }
    let fx = null;
    try {if (data.fx) fx = {...parseFx({base:'USD', quote:'SGD', ...data.fx}), checkedAt:data.fx.checkedAt}} catch {}
    return {feeds, fx};
  }
  async function getJson(url) {
    const response = await fetch(url, {signal:AbortSignal.timeout(20000)});
    if (!response.ok) throw Error(`Feed returned ${response.status}`);
    return response.json();
  }
  function create(onUpdate) {
    const state = {feeds:{}, fx:null, loading:false, errors:[], lastAttempt:null};
    try {
      const cached = validateCache(JSON.parse(localStorage.getItem(CACHE_KEY) || 'null'));
      if (cached) Object.assign(state, cached);
    } catch {}
    async function refresh() {
      if (state.loading) return;
      state.loading = true;
      state.errors = [];
      state.lastAttempt = new Date().toISOString();
      onUpdate(state);
      const results = await Promise.allSettled([
        getJson(API+'24722/pricing').then(data => parseFeed(data,24722)),
        getJson(API+'24837/pricing').then(data => parseFeed(data,24837)),
        getJson(FX_API).then(parseFx)
      ]);
      const checkedAt = new Date().toISOString();
      results.forEach((result,index) => {
        if (result.status === 'fulfilled') {
          if (index < 2) state.feeds[result.value.setId] = {...result.value, checkedAt};
          else state.fx = {...result.value, checkedAt};
        } else state.errors.push(['Main-set prices','Classic prices','USD/SGD rate'][index]);
      });
      state.loading = false;
      try {localStorage.setItem(CACHE_KEY, JSON.stringify({version:1, feeds:state.feeds, fx:state.fx}))} catch {}
      onUpdate(state);
    }
    return {state, refresh, interval:INTERVAL};
  }
  const exported = {create, parseFeed, parseFx, quote, summarize, format, validateCache};
  if (typeof module !== 'undefined' && module.exports) module.exports = exported;
  else root.ThirtyPrices = exported;
})(typeof window !== 'undefined' ? window : globalThis);

;
﻿(function(root) {
  const OUTBOX_KEY = 'thirty-backend-outbox-v1' + (root.ThirtyLoginId ? ':' + root.ThirtyLoginId : '');
  function create(options) {
    const ids = new Set(options.ids);
    const storage = options.storage;
    const fetcher = options.fetch || root.fetch.bind(root);
    const initial = {};
    for (const [id,value] of Object.entries(options.initial || {})) if (ids.has(id) && (value === true || Number.isInteger(value) && value > 0)) initial[id] = true;
    const pending = new Map();
    let remote = null, busy = false, timer = null, sequence = 0, storageAvailable = true;
    const state = {owned:{...initial}, status:'loading', pending:0, error:null, lastSynced:null, localPersisted:true};
    try {
      const saved = JSON.parse(storage?.getItem(OUTBOX_KEY) || '{}');
      for (const [id,value] of Object.entries(saved || {})) if (ids.has(id) && typeof value?.owned === 'boolean') pending.set(id,{owned:value.owned,token:++sequence});
    } catch {storageAvailable=false}
    function storePending() {
      try {
        if (!storage) throw Error();
        storage.setItem(OUTBOX_KEY,JSON.stringify(Object.fromEntries(pending)));
        storageAvailable = true;
      } catch {storageAvailable=false}
    }
    function emit() {
      state.owned = {...(remote ? remote.owned : initial)};
      for (const [id,value] of pending) state.owned[id] = value.owned;
      state.pending = pending.size;
      state.localPersisted = storageAvailable;
      options.onChange?.(state);
    }
    function snapshot(data) {
      if (!data || typeof data.initialized !== 'boolean' || !Number.isSafeInteger(data.revision) || data.revision < 0 || !data.owned || Array.isArray(data.owned) || typeof data.owned !== 'object' || !Number.isFinite(Date.parse(data.updatedAt))) throw Error('Invalid storage response');
      const owned = {};
      for (const [id,value] of Object.entries(data.owned)) {
        if (!ids.has(id)) continue;
        if (typeof value !== 'boolean') throw Error('Invalid ownership data');
        owned[id] = value;
      }
      return {...data,owned};
    }
    async function request(body, keepalive = false) {
      const response = await fetcher('/api/collection',{
        method:body ? 'PATCH' : 'GET',
        headers:{...(body ? {'Content-Type':'application/json'} : {'Accept':'application/json'}),...(root.ThirtyLoginId ? {'X-Login-Id':root.ThirtyLoginId} : {})},
        body:body ? JSON.stringify(body) : undefined,
        cache:'no-store', credentials:'same-origin', keepalive,
        signal:root.AbortSignal?.timeout?.(20000)
      });
      if (!response.ok) {
        let code = 'STORAGE_UNAVAILABLE';
        try {code=(await response.json()).error || code} catch {}
        const error = new Error(code);
        error.code = code;
        throw error;
      }
      return snapshot(await response.json());
    }
    async function synchronize(keepalive = false) {
      if (busy) return;
      if (timer) {root.clearTimeout(timer);timer=null}
      busy = true;
      state.status = pending.size ? 'saving' : remote ? 'checking' : 'loading';
      state.error = null;
      emit();
      try {
        if (!remote || !pending.size) remote = await request();
        if (!remote.initialized) {
          remote = await request({action:'initialize',changes:Object.keys(initial).map(id=>({id,owned:true}))},keepalive);
        }
        emit();
        while (pending.size) {
          const batch = [...pending].map(([id,value])=>({id,...value}));
          remote = await request({action:'update',changes:batch.map(({id,owned})=>({id,owned}))},keepalive);
          for (const change of batch) if (pending.get(change.id)?.token === change.token) pending.delete(change.id);
          storePending();
          emit();
        }
        state.status='saved';
        state.lastSynced=new Date().toISOString();
      } catch (error) {
        state.error=error.code || 'STORAGE_UNAVAILABLE';
        state.status=['STORAGE_NOT_CONFIGURED','SCHEMA_NOT_READY'].includes(state.error) ? 'unconfigured' : 'offline';
      } finally {busy=false;emit()}
    }
    function setMany(changes) {
      let changed=false;
      for (const {id,owned} of changes) {
        if (!ids.has(id) || typeof owned !== 'boolean') continue;
        pending.set(id,{owned,token:++sequence});
        changed=true;
      }
      if (!changed) return;
      storePending();
      state.status='queued';
      emit();
      if (timer) root.clearTimeout(timer);
      timer=root.setTimeout(()=>synchronize(),180);
    }
    function setOwned(id,owned) {setMany([{id,owned}])}
    return {state, setOwned, setMany, start:synchronize, refresh:synchronize, flush:()=>synchronize(true),dispose:()=>{if(timer) root.clearTimeout(timer)}};
  }
  const exported={create,OUTBOX_KEY};
  if (typeof module !== 'undefined' && module.exports) module.exports=exported;
  else root.ThirtyCollectionSync=exported;
})(typeof window !== 'undefined' ? window : globalThis);

;
﻿const KEY = 'thirty-tracker-v1' + (window.ThirtyLoginId ? ':' + window.ThirtyLoginId : '');
const VIEW_KEY = 'thirty-tracker-view';
let cards = [], quantities = {}, status = 'all', layout = 'list', limit = 24, activeCard = null;
let pageIndex = 0;
const $ = selector => document.querySelector(selector);
const escape = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[c]));
try {
  const stored = JSON.parse(localStorage.getItem(KEY) || '{}');
  if (stored && typeof stored === 'object' && !Array.isArray(stored)) quantities = stored;
  const savedLayout = localStorage.getItem(VIEW_KEY);
  if (['grid','three'].includes(savedLayout)) layout = savedLayout;
} catch {}
const PRICES = window.ThirtyPrices;
let currency = 'SGD';
try {if (localStorage.getItem('thirty-currency') === 'USD') currency = 'USD'} catch {}
let market = null;
let collectionSync = null;
const count = id => Number.isInteger(quantities[id]) && quantities[id] > 0 ? Math.min(9999, quantities[id]) : 0;
function persist() {
  try {
    localStorage.setItem(KEY, JSON.stringify(quantities));
    if (!collectionSync) $('#storageStatus').textContent = 'Saved on this device. Connecting to backend…';
  } catch {
    if (!collectionSync) $('#storageStatus').textContent = 'Device caching unavailable. Connecting to backend…';
  }
}
function controls(card) {
  return `<label class="owned-check"><input type="checkbox" data-owned="${card.id}" ${count(card.id) ? 'checked' : ''} aria-label="I own ${escape(card.name)}, ${card.group}, card ${card.number}"><span>${count(card.id) ? 'Owned' : 'I have this'}</span></label>`;
}
function image(card) {
  return card.image ? `<img src="${card.image}" alt="${escape(card.name)} ${card.number}" loading="lazy" referrerpolicy="no-referrer">` : '<span class="image-fallback">Image unavailable</span>';
}
function imageErrors() {
  document.querySelectorAll('img').forEach(img => img.onerror = () => {
    const fallback = document.createElement('span');
    fallback.className = 'image-fallback';
    fallback.textContent = 'Image unavailable';
    img.replaceWith(fallback);
  });
}
function cardPrice(card, detail = false) {
  const q = market ? PRICES.quote(card, market.state.feeds) : null;
  if (!q) return '<div class="card-price unavailable"><span>' + (market?.state.loading && card.pricing ? 'Loading price…' : 'Price unavailable') + '</span></div>';
  const text = PRICES.format(q.usd, currency, market.state.fx);
  const detailText = detail ? '<small>Holofoil market estimate · Updated ' + escape(singaporeTime(q.updated)) + '</small><a target="_blank" rel="noopener" href="https://www.tcgplayer.com/product/' + q.productId + '">View TCGplayer listing ↗</a>' : '<small>Market · Holofoil</small>';
  return '<div class="card-price"><strong>' + text + '</strong>' + (text === '—' ? '<small>SGD rate unavailable · switch to USD</small>' : detailText) + '</div>';
}
function singaporeTime(value) {
  return new Intl.DateTimeFormat('en-SG', {dateStyle:'medium', timeStyle:'short', timeZone:'Asia/Singapore'}).format(new Date(value)) + ' SGT';
}
function renderValuation() {
  if (!market) return;
  const state = market.state;
  const totals = PRICES.summarize(cards, id => count(id) > 0, state.feeds);
  const owned = cards.filter(card => count(card.id) > 0).length;
  const loaded = Object.keys(state.feeds).length > 0;
  const money = n => loaded ? PRICES.format(n, currency, state.fx) : '—';
  $('#ownedValue').textContent = money(totals.owned);
  $('#missingValue').textContent = money(totals.missing);
  $('#setValue').textContent = money(totals.all);
  $('#ownedValueCoverage').textContent = (totals.unpricedOwned ? 'Partial · ' : '') + totals.ownedCount + ' of ' + owned + ' owned cards priced' + (totals.unpricedOwned ? ' · ' + totals.unpricedOwned + ' unpriced' : '');
  $('#missingValueCoverage').textContent = (totals.unpricedMissing ? 'Partial · ' : '') + totals.missingCount + ' of ' + (cards.length - owned) + ' missing cards priced';
  $('#setValueCoverage').textContent = (totals.priced < cards.length ? 'Partial · ' : '') + totals.priced + ' of ' + cards.length + ' cards priced';
  const dates = Object.values(state.feeds).map(feed => Date.parse(feed.updated));
  const oldest = dates.length ? Math.min(...dates) : null;
  const isOld = oldest !== null && Date.now() - oldest > 48 * 60 * 60 * 1000;
  const perFeed = Object.values(state.feeds).map(feed => (feed.setId === 24722 ? 'Main' : 'Classic') + ': ' + singaporeTime(feed.updated)).join(' · ');
  const checked = Object.values(state.feeds).map(feed => Date.parse(feed.checkedAt));
  let message = state.loading ? 'Checking latest prices…' : state.errors.length ? 'Refresh failed for ' + state.errors.join(', ') + '. ' + (loaded ? 'Showing last available data.' : 'Prices unavailable; try Refresh.') : 'Auto-check every 15 min · Provider updates daily';
  if (isOld) message += ' · Price data is over 48 hours old';
  if (perFeed) message += ' · ' + perFeed;
  if (checked.length && !state.loading) message += ' · Last checked ' + singaporeTime(new Date(Math.max(...checked)).toISOString());
  $('#marketStatus').textContent = message;
  $('#marketStatus').classList.toggle('market-warning', !!state.errors.length || isOld);
  const fx = state.fx;
  $('#fxStatus').textContent = fx ? '1 USD = ' + fx.rate.toFixed(4) + ' SGD · FX date ' + fx.date + (Date.now() - Date.parse(fx.date + 'T23:59:59Z') > 4 * 86400000 ? ' · Older reference rate' : '') : 'USD/SGD rate unavailable. USD prices can still be displayed.';
  $('#refreshPrices').disabled = state.loading;
  $('#refreshPrices').textContent = state.loading ? 'Refreshing…' : '↻ Refresh prices';
  document.querySelectorAll('[data-currency]').forEach(button => {
    const selected = button.dataset.currency === currency;
    button.classList.toggle('selected', selected);
    button.setAttribute('aria-pressed', String(selected));
  });
}
function render() {
  const owned = cards.filter(card => count(card.id) > 0).length;
  $('#owned').textContent = owned;
  $('#missing').textContent = cards.length - owned;
  $('#copyMissing').textContent = 'Copy missing cards (' + (cards.length - owned) + ')';
  $('#copyMissing').disabled = owned === cards.length;
  $('#percent').textContent = (cards.length ? Math.round(owned / cards.length * 100) : 0) + '%';
  $('#progress').value = owned;
  $('#progress').max = cards.length;
  const selectedRarity = $('#rarity').value;
  const rarityCards = cards.filter(card => card.rarity === selectedRarity);
  const rarityOwned = rarityCards.filter(card => count(card.id) > 0).length;
  $('#checkRarity').disabled = !rarityCards.length || rarityOwned === rarityCards.length;
  $('#uncheckRarity').disabled = !rarityOwned;
  $('#checkRarity').textContent = rarityCards.length ? 'Check all ' + selectedRarity : 'Check all in rarity';
  $('#uncheckRarity').textContent = rarityCards.length ? 'Uncheck all ' + selectedRarity : 'Uncheck all in rarity';
  $('#rarityProgress').textContent = rarityCards.length ? rarityOwned + ' / ' + rarityCards.length + ' ' + selectedRarity + ' cards owned' : 'Select a rarity to check or uncheck the whole group.';
  const query = $('#search').value.trim().toLowerCase();
  const list = cards.filter(card =>
    (status === 'all' || status === 'owned' && count(card.id) > 0 || status === 'missing' && !count(card.id)) &&
    ($('#group').value === 'all' || $('#group').value === card.group) &&
    (!$('#rarity').value || $('#rarity').value === 'all' || $('#rarity').value === card.rarity) &&
    (!query || card.name.toLowerCase().includes(query) || card.number.includes(query))
  );
  if ($('#sort').value === 'name') list.sort((a,b) => a.name.localeCompare(b.name) || Number(a.number)-Number(b.number));
  if ($('#sort').value.startsWith('price-')) list.sort((a,b) => {
    const pa = market ? PRICES.quote(a, market.state.feeds)?.usd : null;
    const pb = market ? PRICES.quote(b, market.state.feeds)?.usd : null;
    if (pa == null) return pb == null ? 0 : 1;
    if (pb == null) return -1;
    return $('#sort').value === 'price-high' ? pb - pa : pa - pb;
  });
  const pageCount = Math.max(1, Math.ceil(list.length / 9));
  pageIndex = Math.min(pageIndex, pageCount - 1);
  const shown = layout === 'three' ? list.slice(pageIndex * 9, pageIndex * 9 + 9) : layout === 'list' ? list : list.slice(0, limit);
  $('#grid').classList.toggle('list-layout', layout === 'list');
  $('#grid').classList.toggle('three-layout', layout === 'three');
  $('#grid').innerHTML = shown.map(card => `<article class="checklist-card ${count(card.id) ? 'is-owned' : ''}"><div class="card-art ${count(card.id) ? 'owned' : ''}" style="--bg:#e9e7db"><span class="card-index">#${card.number}</span><button class="view" data-card="${card.id}" aria-label="Inspect ${escape(card.name)} ${card.number}">${image(card)}</button></div><div class="card-info"><div><h3>${escape(card.name)}</h3><p>${card.group} · #${card.printedNumber || card.number} · ${escape(card.rarity || "")}</p></div></div>${cardPrice(card)}${controls(card)}</article>`).join('');
  $('#results').textContent = `${list.length} matching cards` + (layout === 'grid' ? ` · Showing ${shown.length}` : layout === 'three' ? ` · ${shown.length} cards on this page` : '');
  $('#empty').hidden = list.length > 0;
  $('#loadMore').hidden = layout !== 'grid' || limit >= list.length;
  $('#gridPagination').hidden = layout !== 'three' || !list.length;
  $('#pageInfo').textContent = 'Page ' + (pageIndex + 1) + ' of ' + pageCount;
  $('#previousPage').disabled = pageIndex === 0;
  $('#nextPage').disabled = pageIndex >= pageCount - 1;
  document.querySelectorAll('[data-layout]').forEach(button => {
    const selected = button.dataset.layout === layout;
    button.classList.toggle('selected', selected);
    button.setAttribute('aria-pressed', String(selected));
  });
  imageErrors();
  try {renderValuation()} catch (error) {console.error("Price dashboard unavailable", error)}
}
function openCard(card) {
  activeCard = card;
  $('#detailContent').innerHTML = `${image(card)}<div><p class="eyebrow">30TH CELEBRATION</p><h2>${escape(card.name)}</h2><p>${card.group} · #${card.printedNumber || card.number} · ${escape(card.rarity || "")}</p>${cardPrice(card,true)}${controls(card)}</div>`;
  imageErrors();
}
function setOwned(id, checked) {
  if (!cards.some(card => card.id === id)) return;
  quantities[id] = checked ? Math.max(1, count(id)) : 0;
  persist();
  collectionSync?.setOwned(id,checked);
  render();
  if (activeCard && $('#detail').open) openCard(activeCard);
}
function setRarityOwned(owned) {
  const rarity=$('#rarity').value;
  if (!rarity || rarity === 'all') return;
  const changes=cards.filter(card => card.rarity === rarity && (count(card.id) > 0) !== owned).map(card => ({id:card.id,owned}));
  if (!changes.length) return;
  for (const change of changes) quantities[change.id]=owned ? 1 : 0;
  persist();
  collectionSync?.setMany(changes);
  render();
  if (activeCard && $('#detail').open) openCard(activeCard);
}
$('#checkRarity').onclick=()=>setRarityOwned(true);
$('#uncheckRarity').onclick=()=>setRarityOwned(false);

document.addEventListener('change', event => {
  const checkbox = event.target.closest('[data-owned]');
  if (!checkbox) return;
  const id = checkbox.dataset.owned;
  const inDialog = $('#detail').contains(checkbox);
  setOwned(id, checkbox.checked);
  // Preserve keyboard focus after rebuilding the filtered checklist.
  const container = inDialog ? $('#detail') : $('#grid');
  const replacement = container.querySelector(`[data-owned="${id}"]`);
  if (replacement) replacement.focus({preventScroll:true});
  else document.querySelector('[data-status].selected')?.focus({preventScroll:true});
});
document.addEventListener('click', event => {
  const button = event.target.closest('[data-card]');
  if (button) {
    openCard(cards.find(card => card.id === button.dataset.card));
    $('#detail').showModal();
  }
});
document.querySelectorAll('[data-status]').forEach(button => button.onclick = () => {
  status = button.dataset.status;
  limit = 24; pageIndex = 0;
  document.querySelectorAll('[data-status]').forEach(other => {
    other.classList.toggle('selected', other === button);
    other.setAttribute('aria-pressed', String(other === button));
  });
  render();
});
document.querySelectorAll('[data-layout]').forEach(button => button.onclick = () => {
  layout = button.dataset.layout;
  limit = 24; pageIndex = 0;
  try {localStorage.setItem(VIEW_KEY, layout)} catch {}
  render();
});
for (const selector of ['#search', '#group', '#rarity', '#sort']) $(selector).addEventListener(selector === '#search' ? 'input' : 'change', () => {
  // Reset incompatible filters so switching collections exposes their cards.
  const group = $('#group').value, rarity = $('#rarity').value;
  if (group !== 'all' && rarity !== 'all' && !cards.some(card => card.group === group && card.rarity === rarity)) {
    if (selector === '#group') $('#rarity').value = 'all';
    if (selector === '#rarity') $('#group').value = 'all';
  }
  limit = 24; pageIndex = 0; render();
});
$('#loadMore').onclick = () => {limit += 24; render()};
$('#previousPage').onclick = () => {pageIndex = Math.max(0, pageIndex - 1); render()};
$('#nextPage').onclick = () => {pageIndex++; render()};
$('.close').onclick = () => $('#detail').close();
$('#detail').onclick = event => {
  if (event.target !== $('#detail')) return;
  const rect = event.target.getBoundingClientRect();
  if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) event.target.close();
};
window.addEventListener('storage', event => {
  if (event.key !== KEY) return;
  if (collectionSync) {collectionSync.refresh(); return}
  try {
    const data = JSON.parse(event.newValue || '{}');
    if (data && typeof data === 'object' && !Array.isArray(data)) {quantities = data; render()}
  } catch {}
});
document.querySelectorAll('[data-currency]').forEach(button => button.onclick = () => {
  currency = button.dataset.currency;
  try {localStorage.setItem('thirty-currency', currency)} catch {}
  render();
  if (activeCard && $('#detail').open) openCard(activeCard);
});
function missingCardText() {
  const missing = cards.filter(card => !count(card.id));
  if (!missing.length) return {text:'', count:0};
  const lines = ['Pokémon TCG — 30th Celebration', 'Missing cards: ' + missing.length];
  for (const group of ['Main set','Classic Collection','Energy']) {
    const entries = missing.filter(card => card.group === group);
    if (!entries.length) continue;
    lines.push('', group + ' (' + entries.length + ')');
    for (const card of entries) lines.push('#' + (card.printedNumber || card.number) + ' — ' + card.name);
  }
  return {text:lines.join('\n'), count:missing.length};
}
async function copyMissingCards() {
  const result = missingCardText();
  if (!result.count) {
    $('#copyStatus').textContent = 'No missing cards — your checklist is complete!';
    return;
  }
  const button = $('#copyMissing');
  button.disabled = true;
  try {
    if (!navigator.clipboard?.writeText) throw Error('Clipboard unavailable');
    await navigator.clipboard.writeText(result.text);
    $('#copyStatus').textContent = 'Copied ' + result.count + ' missing cards to clipboard.';
  } catch {
    let copied = false;
    const temporary = document.createElement('textarea');
    temporary.value = result.text;
    temporary.setAttribute('readonly','');
    temporary.style.cssText = 'position:fixed;top:0;left:0;width:1px;height:1px;opacity:0;';
    document.body.appendChild(temporary);
    try {
      temporary.select();
      copied = typeof document.execCommand === 'function' && document.execCommand('copy');
    } catch {} finally {temporary.remove()}
    if (copied) {
      $('#copyStatus').textContent = 'Copied ' + result.count + ' missing cards to clipboard.';
      button.focus({preventScroll:true});
    } else {
      $('#copyStatus').textContent = 'Clipboard access blocked. Your missing list is ready to copy below.';
      $('#missingText').value = result.text;
      $('#copyFallback').showModal();
      $('#missingText').focus();
      $('#missingText').select();
    }
  } finally {button.disabled = cards.every(card => count(card.id) > 0)}
}
$('#copyMissing').onclick = copyMissingCards;
$('#closeCopyFallback').onclick = () => $('#copyFallback').close();
$('#selectMissingText').onclick = () => {$('#missingText').focus(); $('#missingText').select()};

// Checklist data is shipped inside the HTML. No data fetch or price feed can block it.
function initializeBackend() {
  if (!window.ThirtyCollectionSync) {
    $('#storageStatus').textContent = 'Backend sync unavailable. Your checks remain saved on this device.';
    return;
  }
  let storage;
  try {storage=localStorage} catch {}
  collectionSync=window.ThirtyCollectionSync.create({
    ids:cards.map(card=>card.id), initial:quantities, storage,
    onChange:state=>{
      quantities=Object.fromEntries(Object.entries(state.owned).map(([id,owned])=>[id,owned ? 1 : 0]));
      persist();
      const messages={
        loading:'Loading your collection from the backend…',
        checking:'Checking for changes from other devices…',
        queued:'Changes queued for saving…',
        saving:'Saving to backend…',
        saved:'Saved to backend · shared across devices',
        unconfigured:'Backend not configured. Your changes are queued on this device.',
        offline:state.pending ? 'Backend unavailable · ' + state.pending + ' change(s) waiting to save. Retrying automatically.' : 'Backend unavailable. Showing this device’s cached collection.'
      };
      $('#storageStatus').textContent=messages[state.status] || 'Checking save status…';
      if (!state.localPersisted && state.pending) $('#storageStatus').textContent+=' Keep this page open: device caching is unavailable.';
      $('#storageStatus').classList.toggle('sync-warning',['offline','unconfigured'].includes(state.status));
      $('#retrySync').hidden=!['offline','unconfigured'].includes(state.status);
      render();
      if (activeCard && $('#detail').open) openCard(activeCard);
    }
  });
  $('#retrySync').onclick=()=>collectionSync.refresh();
  collectionSync.start();
  setInterval(()=>{if (!document.hidden) collectionSync.refresh()},30000);
  window.addEventListener('online',()=>collectionSync.refresh());
  window.addEventListener('pagehide',()=>collectionSync.flush());
  document.addEventListener('visibilitychange',()=>{if (!document.hidden) collectionSync.refresh()});
}

function initializeChecklist() {
  try {
    const data = JSON.parse($('#checklist-data').textContent);
    if (!Array.isArray(data) || data.length !== 196 || data.some(card => !card.id || !card.name || !card.group || !card.number)) throw Error('Invalid embedded checklist');
    cards = data;
    persist();
    render();
  } catch (error) {
    console.error('Checklist initialization failed', error);
    $('#results').textContent = 'The card checklist is shown below. Automatic saving could not start; please reopen this page.';
    return;
  }
  initializeBackend();
  // Pricing is optional: initialize it only after the collection can be checked.
  if (!PRICES || typeof PRICES.create !== 'function') {
    $('#marketStatus').textContent = 'Pricing is unavailable. Your card checklist still works.';
    $('#refreshPrices').disabled = true;
    return;
  }
  try {
    market = PRICES.create(() => {
      const focusId = document.activeElement?.dataset?.owned;
      render();
      if (activeCard && $('#detail').open) openCard(activeCard);
      if (focusId) {
        const container = $('#detail').open ? $('#detail') : $('#grid');
        container.querySelector('[data-owned="' + focusId + '"]')?.focus({preventScroll:true});
      }
    });
    $('#refreshPrices').onclick = () => market.refresh();
    setInterval(() => {if (!document.hidden) market.refresh()}, market.interval);
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden && (!market.state.lastAttempt || Date.now() - Date.parse(market.state.lastAttempt) >= market.interval)) market.refresh();
    });
    market.refresh();
  } catch (error) {
    console.error('Pricing initialization failed', error);
    market = null;
    $('#marketStatus').textContent = 'Pricing is unavailable. Your card checklist still works.';
  }
}
window.ThirtyStartChecklist = initializeChecklist;
if (window.ThirtyLoginId !== null) initializeChecklist();
