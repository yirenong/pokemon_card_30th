/* Market data is fetched at runtime. No prices or FX rates are embedded here. */
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
