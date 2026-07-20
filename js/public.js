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

  const AUDIENCE_FILTERS = [
    { key: 'players', label: 'Players' },
    { key: 'makers', label: 'Makers' },
    { key: 'learners', label: 'Learners' },
  ];

  const state = { events: [], scopes: [], selected: null, audienceFilter: new Set() };

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

  // Coarse 3-way grouping for the audience filter chips (distinct from the
  // finer-grained badge above): Players / Makers / Learners. Matches each
  // audience value exactly (not a loose substring search) — "Other Industry
  // Players" is a makers/industry category, not a player one, but a naive
  // `.includes('player')` check would wrongly catch it too; and "General
  // Public" is deliberately left unbucketed since it isn't specifically any
  // of the three.
  const AUDIENCE_BUCKET_MAP = {
    'beginner players': 'players',
    'experienced players': 'players',
    'beginner makers': 'makers',
    'experienced makers': 'makers',
    'other industry players': 'makers',
    students: 'learners',
    academics: 'learners',
  };
  function audienceBuckets(ev) {
    const buckets = new Set();
    ev.audiences.forEach((raw) => {
      const bucket = AUDIENCE_BUCKET_MAP[raw.toLowerCase().trim()];
      if (bucket) buckets.add(bucket);
    });
    return buckets;
  }
  function passesAudienceFilter(ev) {
    if (!state.audienceFilter.size) return true;
    const buckets = audienceBuckets(ev);
    return [...state.audienceFilter].some((b) => buckets.has(b));
  }

  /* ---- scopes (rail entries) ---- */
  function eventsForScope(key) {
    if (dayByIso[key]) return state.events.filter((e) => e.dayIsos.includes(key));
    return state.events.filter((e) => e.region === key);
  }
  function buildScopes() {
    const scopes = [];
    // Before / every festival day / After / Other — all always shown, even with
    // zero events yet, so the rail never silently drops a date option.
    scopes.push(scopeFor('before'));
    CFG.FESTIVAL_DAYS.forEach((d) => scopes.push({ key: d.iso, short: d.short, sub: d.dow }));
    scopes.push(scopeFor('after'));
    scopes.push(scopeFor('other'));
    return scopes;
  }
  const scopeFor = (k) => { const r = REGIONS.find((x) => x.key === k); return { key: k, short: r.short, sub: r.sub }; };

  /* ---- rendering ---- */
  function railHtml() {
    return state.scopes.map((s) =>
      `<button class="rail-item ${s.key === state.selected ? 'active' : ''}" data-scope="${esc(s.key)}">
        <span class="lbl">${esc(s.short)}</span><span class="sub">${esc(s.sub)}</span></button>`).join('');
  }
  // Mobile-only day switcher (a native <select> replaces the horizontal-scroll
  // rail below the tablet breakpoint — see .mobile-day-picker in public.css).
  function mobileOptionsHtml() {
    return state.scopes.map((s) =>
      `<option value="${esc(s.key)}" ${s.key === state.selected ? 'selected' : ''}>${esc(s.short)} — ${esc(s.sub)}</option>`).join('');
  }

  function audienceFilterHtml() {
    const allActive = state.audienceFilter.size === 0;
    const chips = [`<button class="aud-chip ${allActive ? 'active' : ''}" data-aud="">All</button>`]
      .concat(AUDIENCE_FILTERS.map((f) =>
        `<button class="aud-chip ${state.audienceFilter.has(f.key) ? 'active' : ''}" data-aud="${f.key}">${esc(f.label)}</button>`));
    return chips.join('');
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
    $('#mobileDaySelect').innerHTML = mobileOptionsHtml();
    $('#audienceFilter').innerHTML = audienceFilterHtml();
    const dayEvs = eventsForScope(state.selected);
    const evs = dayEvs.filter(passesAudienceFilter).slice()
      .sort((a, b) => (a.startMin ?? 1e9) - (b.startMin ?? 1e9));
    const scope = state.scopes.find((s) => s.key === state.selected);
    $('#dayTitle').textContent = scope ? scope.short : '';
    $('#timeRange').textContent = headerRange(evs);
    $('#cards').innerHTML = evs.length ? evs.map(cardHtml).join('') : emptyStateHtml(dayEvs.length > 0);
  }

  function emptyStateHtml(hasAnyForDay) {
    if (hasAnyForDay) {
      return `<div class="empty-public"><p>No events match this filter for this date.</p></div>`;
    }
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
        $('#cards').innerHTML = emptyStateHtml(false);
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
  $('#mobileDaySelect').addEventListener('change', (e) => {
    state.selected = e.target.value;
    render();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
  $('#audienceFilter').addEventListener('click', (e) => {
    const t = e.target.closest('[data-aud]');
    if (!t) return;
    const key = t.dataset.aud;
    if (key === '') state.audienceFilter.clear();
    else if (state.audienceFilter.has(key)) state.audienceFilter.delete(key);
    else state.audienceFilter.add(key);
    render();
  });

  load();
})();
