/* SGF Schedule — Public page. Shows only Published = Y events, grouped by day,
 * styled to the festival design. Reads the sanitised CSV (falls back to sample). */
(function () {
  const CFG = window.SGF_CONFIG;
  const $ = (s, r = document) => r.querySelector(s);
  const esc = (s) =>
    String(s == null ? '' : s).replace(/[&<>"']/g, (c) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const PLACEHOLDER = '???';
  const dayByIso = Object.fromEntries(CFG.FESTIVAL_DAYS.map((d) => [d.iso, d]));
  const REGIONS = [
    { key: 'before', short: 'BEFORE', sub: 'Pre-festival' },
    { key: 'after', short: 'AFTER', sub: 'Post-festival' },
    { key: 'other', short: 'SOON', sub: 'Date TBD' },
  ];

  const state = { events: [], scopes: [], selected: null };

  /* ---- time formatting ---- */
  const parts = (m) => {
    let h = Math.floor(m / 60);
    const min = m % 60;
    const ap = h >= 12 ? 'PM' : 'AM';
    h = h % 12; if (h === 0) h = 12;
    return { hm: min ? `${h}:${String(min).padStart(2, '0')}` : `${h}:00`, hour: String(h), ap, min };
  };
  // Card time, e.g. "5:00 – 11:00 PM"
  function eventTime(ev) {
    if (ev.startMin != null) {
      const s = parts(ev.startMin);
      if (ev.endMin != null) {
        const e = parts(ev.endMin);
        return s.ap === e.ap ? `${s.hm} – ${e.hm} ${e.ap}` : `${s.hm} ${s.ap} – ${e.hm} ${e.ap}`;
      }
      return `${s.hm} ${s.ap}`;
    }
    const slots = [...new Set(ev.schedule.filter((x) => x.slot).map((x) => x.slot))];
    return slots.join(' · ');
  }
  // Big header range (hour-only), e.g. "5 - 11 PM"
  function headerRange(evs) {
    const timed = evs.filter((e) => e.startMin != null);
    if (!timed.length) return '';
    const lo = parts(Math.min(...timed.map((e) => e.startMin)));
    const hiVals = timed.map((e) => e.endMin ?? e.startMin);
    const hi = parts(Math.max(...hiVals));
    const l = lo.min ? lo.hm : lo.hour;
    const h = hi.min ? hi.hm : hi.hour;
    return lo.ap === hi.ap ? `${l} - ${h} ${hi.ap}` : `${l} ${lo.ap} - ${h} ${hi.ap}`;
  }

  /* ---- audience badge (most specific) ---- */
  function audienceBadge(ev) {
    const a = ev.audiences.join(' ').toLowerCase();
    if (a.includes('maker')) return 'MAKERS';
    if (a.includes('industry')) return 'INDUSTRY';
    if (a.includes('academic')) return 'ACADEMICS';
    if (a.includes('student')) return 'STUDENTS';
    if (a.includes('player')) return 'PLAYERS';
    if (a.includes('public')) return 'PUBLIC';
    return ev.audiences[0] ? ev.audiences[0].toUpperCase() : '';
  }

  /* ---- scopes (rail entries) ---- */
  function eventsForScope(key) {
    if (dayByIso[key]) return state.events.filter((e) => e.dayIsos.includes(key));
    return state.events.filter((e) => e.region === key);
  }
  function buildScopes() {
    const scopes = [];
    // Catch-all buckets only appear when they actually hold events.
    if (state.events.some((e) => e.region === 'before')) scopes.push(scopeFor('before'));
    // Every festival day is always shown, even with zero events yet.
    CFG.FESTIVAL_DAYS.forEach((d) => scopes.push({ key: d.iso, short: d.short, sub: d.dow }));
    ['after', 'other'].forEach((k) => { if (state.events.some((e) => e.region === k)) scopes.push(scopeFor(k)); });
    return scopes;
  }
  const scopeFor = (k) => { const r = REGIONS.find((x) => x.key === k); return { key: k, short: r.short, sub: r.sub }; };

  /* ---- rendering ---- */
  function railHtml() {
    return state.scopes.map((s) =>
      `<button class="rail-item ${s.key === state.selected ? 'active' : ''}" data-scope="${esc(s.key)}">
        ${esc(s.short)}<span class="sub">${esc(s.sub)}</span></button>`).join('');
  }

  function footCell(ico, text) {
    return `<div class="cell"><span class="ico">${ico}</span>${esc(text || PLACEHOLDER)}</div>`;
  }
  function cardHtml(ev) {
    const badge = audienceBadge(ev);
    const img = ev.thumbnail
      ? `<img src="${esc(ev.thumbnail)}" alt="${esc(ev.title)}" onerror="this.onerror=null;this.src='images/placeholder.svg'">`
      : `<img src="images/placeholder.svg" alt="">`;
    const tickets = ev.ticketUrl
      ? `<a class="btn-tickets" href="${esc(ev.ticketUrl)}" target="_blank" rel="noopener">GET TICKETS</a>`
      : `<span class="btn-tickets" aria-disabled="true">GET TICKETS</span>`;
    const gameType = ev.gameTypes[0] ? ev.gameTypes[0].toUpperCase() : '';
    return `<article class="pcard">
      <div class="pcard-top">
        <span class="pcard-time">${esc(eventTime(ev)) || PLACEHOLDER}</span>
        <span class="spacer"></span>
        ${badge ? `<span class="badge-makers">★ ${esc(badge)}</span>` : ''}
        ${tickets}
      </div>
      <h2 class="pcard-title">${esc(ev.title || PLACEHOLDER)}</h2>
      <p class="pcard-sub">${esc(ev.organisation || PLACEHOLDER)}</p>
      <div class="pcard-body">
        <div class="pcard-img">${img}</div>
        <div class="pcard-about">
          <h3>About</h3>
          <p>${esc(ev.blurb || ev.description || PLACEHOLDER)}</p>
        </div>
      </div>
      <div class="pcard-foot">
        ${footCell('🎮', gameType)}
        ${footCell('📍', ev.location)}
        ${footCell('⏳', ev.duration)}
      </div>
    </article>`;
  }

  function render() {
    const loading = $('#loading'); if (loading) loading.hidden = true;
    $('.day-header').hidden = false;
    $('#rail').innerHTML = railHtml();
    const evs = eventsForScope(state.selected).slice()
      .sort((a, b) => (a.startMin ?? 1e9) - (b.startMin ?? 1e9));
    const scope = state.scopes.find((s) => s.key === state.selected);
    $('#dayTitle').textContent = scope ? scope.short : '';
    $('#timeRange').textContent = headerRange(evs);
    $('#cards').innerHTML = evs.length ? evs.map(cardHtml).join('') : emptyStateHtml();
  }

  function emptyStateHtml() {
    return `<div class="empty-public">
      <p>No events announced yet for this date — check back soon!</p>
      <a class="btn-notify" href="${esc(CFG.NOTIFY_FORM_URL)}" target="_blank" rel="noopener">Get notified of updates</a>
    </div>`;
  }

  /* ---- load ---- */
  async function load() {
    try {
      const { events } = await window.SGF.loadEvents('public');
      state.events = events.filter((e) => e.published);
      state.scopes = buildScopes();
      // Open on the first festival day that has events (not a pre-festival bucket).
      const firstDay = state.scopes.find((s) => dayByIso[s.key]);
      state.selected = (firstDay || state.scopes[0] || {}).key || null;
      if (!state.scopes.length) {
        $('#loading').hidden = true;
        $('#cards').innerHTML = emptyStateHtml();
        return;
      }
      render();
    } catch (err) {
      $('#loading').hidden = true;
      $('#cards').innerHTML = `<div class="empty-public">
        <p>Couldn't load the schedule right now. Please try again shortly.</p>
        <a class="btn-notify" href="${esc(CFG.NOTIFY_FORM_URL)}" target="_blank" rel="noopener">Get notified of updates</a>
      </div>`;
    }
  }

  $('#rail').addEventListener('click', (e) => {
    const t = e.target.closest('[data-scope]');
    if (!t) return;
    state.selected = t.dataset.scope;
    render();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });

  load();
})();
