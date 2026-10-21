const KEY = 'thirty-tracker-v1' + (window.ThirtyLoginId ? ':' + window.ThirtyLoginId : '');
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
for (const selector of ['#search', '#group', '#rarity', '#sort']) $(selector).addEventListener(selector === '#search' ? 'input' : 'change', () => {limit = 24; pageIndex = 0; render()});
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
