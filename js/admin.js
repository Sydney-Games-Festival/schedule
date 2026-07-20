/* SGF Schedule — Admin page logic.
 * Views: Day (single day, grouped AM/PM/EVE) · Calendar (time × venue grid) · List (sortable). */
(function () {
  const CFG = window.SGF_CONFIG;
  const AdminStats = window.SGF_ADMIN_STATS;
  const Domain = window.SGF_DOMAIN;
  const Filters = window.SGF_FILTERS;
  const Links = window.SGF_LINKS;
  // Organiser contact details (Name/Email/Mobile/Discord/Alt Contact) are
  // excluded from every published CSV for privacy — look them up directly in
  // the source sheet instead of the app ever fetching/displaying them.
  const SHEET_EDIT_URL = 'https://docs.google.com/spreadsheets/d/1U8jFpmMSGMHrqNflQdCX3hxUbj0xtO4u9xYxRE7H8Pw/edit';
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = (s) =>
    String(s == null ? '' : s).replace(/[&<>"']/g, (c) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  const STATUS_COLOR = {
    ideation: 'var(--status-ideation)', early: 'var(--status-early)',
    confirmed: 'var(--status-confirmed)', live: 'var(--status-live)', unknown: 'var(--muted)',
  };
  const STATUS_ORDER = { live: 0, confirmed: 1, early: 2, ideation: 3, unknown: 4 };
  const dayByIso = Object.fromEntries(CFG.FESTIVAL_DAYS.map((d) => [d.iso, d]));

  const SLOTS = [
    { key: 'AM', label: 'Morning', sub: 'before 12pm' },
    { key: 'PM', label: 'Afternoon', sub: '12–5pm' },
    { key: 'EVE', label: 'Evening', sub: '5pm onwards' },
  ];
  // Catch-all buckets for events outside the Oct 12–18 window.
  const REGIONS = [
    { key: 'before', tab: 'Before', dow: 'pre', label: 'Before the festival' },
    { key: 'after', tab: 'After', dow: 'post', label: 'After the festival' },
    { key: 'other', tab: 'Other', dow: 'TBD', label: 'Other / date TBD' },
  ];

  const state = {
    all: [],
    dataSourceMode: CFG.ADMIN_DATA_SOURCE_MODE === 'sample' ? 'sample' : 'live',
    view: 'schedule',
    day: 'all',
    sort: { key: 'day', dir: 1 },
    filters: { search: '', statuses: new Set(CFG.STATUSES.map((s) => s.key)), audience: '', game: '', day: '', pub: '' },
  };

  /* ---------- helpers ---------- */
  const fmtMin = (m) => {
    let h = Math.floor(m / 60), min = m % 60;
    const ap = h >= 12 ? 'PM' : 'AM';
    h = h % 12; if (h === 0) h = 12;
    return `${h}:${String(min).padStart(2, '0')} ${ap}`;
  };
  function timeLabel(ev) {
    return Domain.eventTimeLabel(ev) || Domain.tentativeSlots(ev).join(' · ');
  }
  function listTimeLabel(ev) {
    return Domain.eventTimeRangeLabel(ev, {
      lowercase: true,
      separator: ' - ',
      spaceBeforeMeridiem: false,
    }) || timeLabel(ev) || '—';
  }
  const dayShortsFor = (ev) => Domain.dayShortsFor(ev, dayByIso);

  // Which AM/PM/EVE buckets does an event fall in on a given day?
  function bucketsFor(ev, iso) {
    return Domain.bucketsForDay(ev, iso);
  }

  /* ---------- filtering ---------- */
  function matches(ev) {
    return Filters.matchesAdminFilters(ev, state.filters);
  }

  /* ---------- event card (compact) ---------- */
  const statusBadge = (ev) =>
    `<span class="status-badge" style="background:${STATUS_COLOR[ev.status.key]}">${esc(ev.status.label)}</span>`;

  function evCardHtml(ev, iso, opts = {}) {
    const entry = iso ? ev.schedule.find((e) => e.iso === iso) : null;
    const tentative = entry ? entry.tentative : !ev.confirmedTiming;
    let time = '';
    if (entry && Domain.hasTimedSchedule(ev)) time = Domain.eventTimeLabel(ev, { iso });
    else if (entry && entry.slot) time = entry.slot;
    else if (Domain.hasTimedSchedule(ev)) time = Domain.eventTimeLabel(ev);
    else time = timeLabel(ev);
    const dateLine = opts.showDate && ev.outsideLabel
      ? `<div class="ev-date">📅 ${esc(ev.outsideLabel)}</div>` : '';
    const tags = [
      ...ev.gameTypes.slice(0, 2).map((g) => `<span class="tag">${esc(g)}</span>`),
      ...ev.audiences.slice(0, 1).map((a) => `<span class="tag aud">${esc(a)}</span>`),
    ].join('');
    return `<div class="ev" style="--sc:${STATUS_COLOR[ev.status.key]}" data-id="${ev._id}">
      <div class="ev-top">
        <span class="ev-time">${esc(time) || '—'}${tentative ? ' <span class="tentative-flag">TENT</span>' : ''}</span>
        <span class="pub-dot ${ev.published ? 'y' : 'n'}">${ev.published ? 'PUB' : 'unpub'}</span>
      </div>
      ${dateLine}
      <div class="ev-title">${esc(ev.title)}</div>
      <div class="ev-org">${esc(ev.organisation || ev.organiser || '')}${ev.location ? ' · ' + esc(ev.location) : ''}</div>
      <div class="ev-tags">${statusBadge(ev)}${tags}</div>
    </div>`;
  }

  /* ---------- Schedule view: AM/PM/EVE stacked; single day, all days, or a region ---------- */
  // One festival day: heading + AM/PM/EVE sections. When showEmptySlots is false,
  // empty slots are omitted (used in the all-days overview).
  function dayBlockHtml(iso, list, showEmptySlots) {
    const d = dayByIso[iso];
    const dayEvents = list.filter((ev) => ev.dayIsos.includes(iso));
    const sections = SLOTS.map((slot) => {
      const evs = dayEvents
        .filter((ev) => bucketsFor(ev, iso).has(slot.key))
        .sort((a, b) => (a.startMin ?? 1e9) - (b.startMin ?? 1e9));
      if (!evs.length && !showEmptySlots) return '';
      const cards = evs.length ? evs.map((ev) => evCardHtml(ev, iso)).join('') : '<div class="day-empty">Nothing yet</div>';
      return `<section class="slot-col"><header>
          <span class="slot-name">${slot.label}</span>
          <span class="slot-sub">${slot.sub}</span>
          <span class="cnt">${evs.length}</span>
        </header><div class="slot-body">${cards}</div></section>`;
    }).join('');
    return `<div class="day-block">
      <div class="day-head"><h2 class="head">${d.short}</h2><span class="dow">${d.label} · ${dayEvents.length} event${dayEvents.length === 1 ? '' : 's'}</span></div>
      <div class="slots">${sections || '<div class="day-empty">No events scheduled</div>'}</div></div>`;
  }

  // One out-of-window region (Before / After / Other) as a flat card grid.
  function regionBlockHtml(region, list) {
    const evs = list.filter((ev) => ev.region === region.key)
      .sort((a, b) => (a.outsideIso || '').localeCompare(b.outsideIso || '') || (a.startMin ?? 1e9) - (b.startMin ?? 1e9));
    if (!evs.length) return '';
    const cards = evs.map((ev) => evCardHtml(ev, null, { showDate: true })).join('');
    return `<div class="day-block region-block">
      <div class="day-head"><h2 class="head">${esc(region.tab)}</h2><span class="dow">${esc(region.label)} · ${evs.length} event${evs.length === 1 ? '' : 's'}</span></div>
      <div class="slot-body region-body">${cards}</div></div>`;
  }

  // All-days matrix: festival days across columns, AM/PM/EVE down rows.
  function dayMatrixHtml(list) {
    const days = CFG.FESTIVAL_DAYS;
    const cols = `96px repeat(${days.length}, minmax(200px, 1fr))`;
    let cells = '<div class="mtx-corner"></div>';
    cells += days.map((d) => {
      const n = list.filter((ev) => ev.dayIsos.includes(d.iso)).length;
      return `<div class="mtx-dayhead"><span class="d">${d.short}</span><span class="dow">${d.dow}</span><span class="cnt">${n}</span></div>`;
    }).join('');
    cells += SLOTS.map((slot) => {
      let row = `<div class="mtx-rowlabel"><span class="slot-name">${slot.label}</span><span class="slot-sub">${slot.sub}</span></div>`;
      row += days.map((d) => {
        const evs = list
          .filter((ev) => ev.dayIsos.includes(d.iso) && bucketsFor(ev, d.iso).has(slot.key))
          .sort((a, b) => (a.startMin ?? 1e9) - (b.startMin ?? 1e9));
        const inner = evs.length ? evs.map((ev) => evCardHtml(ev, d.iso)).join('') : '<div class="mtx-empty">·</div>';
        return `<div class="mtx-cell">${inner}</div>`;
      }).join('');
      return row;
    }).join('');
    return `<div class="mtx-wrap"><div class="day-matrix" style="grid-template-columns:${cols}">${cells}</div></div>`;
  }

  function renderSchedule(list) {
    let html;
    if (state.day === 'all') {
      // Festival week as a day × slot matrix, then out-of-window buckets below.
      const matrix = dayMatrixHtml(list);
      const regions = REGIONS.map((rg) => regionBlockHtml(rg, list)).join('');
      html = matrix + regions;
    } else if (dayByIso[state.day]) {
      html = dayBlockHtml(state.day, list, true);
    } else {
      const region = REGIONS.find((r) => r.key === state.day);
      html = region ? regionBlockHtml(region, list) : '';
      if (!html) html = '<div class="empty-state">No events in this group.</div>';
    }
    $('#scheduleView').innerHTML = html;
  }

  function statsBucketsForEvent(ev) {
    if (state.filters.day && state.filters.day !== 'unscheduled') return [state.filters.day];
    if (state.filters.day === 'unscheduled') return [AdminStats.OTHER_KEY];
    return AdminStats.eventDayBuckets(ev);
  }

  function statsRowDefs(list, kind) {
    if (kind === 'status') {
      const rows = CFG.STATUSES.map((status) => ({
        key: status.key,
        label: status.label,
        match: (ev) => ev.status.key === status.key,
      }));
      if (list.some((ev) => ev.status.key === 'unknown')) {
        rows.push({ key: 'unknown', label: 'Unknown', match: (ev) => ev.status.key === 'unknown' });
      }
      return rows;
    }
    const types = [...new Set(list.flatMap((ev) => ev.gameTypes))].sort((a, b) => a.localeCompare(b));
    return types.map((type) => ({
      key: type,
      label: type,
      match: (ev) => ev.gameTypes.includes(type),
    }));
  }

  function statsTableHtml(title, subtitle, summary) {
    const head = summary.columns.map((col) => `<th>${esc(col.label)}</th>`).join('');
    const body = summary.rows.length
      ? summary.rows.map((row) =>
        `<tr>
          <td>${esc(row.label)}</td>
          ${summary.columns.map((col) => `<td>${row.counts[col.key]}</td>`).join('')}
          <td>${row.total}</td>
        </tr>`).join('')
      : `<tr><td>No matching rows</td>${summary.columns.map(() => '<td>0</td>').join('')}<td>0</td></tr>`;
    const totalRow = `<tr class="total-row">
      <td>Total</td>
      ${summary.columns.map((col) => `<td>${summary.totals.counts[col.key]}</td>`).join('')}
      <td>${summary.totals.total}</td>
    </tr>`;
    return `<section class="stats-block">
      <header class="stats-head">
        <h3>${esc(title)}</h3>
        <p>${esc(subtitle)}</p>
      </header>
      <div class="stats-table-wrap">
        <table class="stats-table">
          <thead><tr><th>${esc(title)}</th>${head}<th>Total</th></tr></thead>
          <tbody>${body}${totalRow}</tbody>
        </table>
      </div>
    </section>`;
  }

  function renderStats(list) {
    const columns = AdminStats.defaultColumns(CFG);
    const stageSummary = AdminStats.buildSummary(list, columns, statsRowDefs(list, 'status'), {
      keepZeroRows: true,
      bucketsForEvent: statsBucketsForEvent,
    });
    const typeSummary = AdminStats.buildSummary(list, columns, statsRowDefs(list, 'type'), {
      bucketsForEvent: statsBucketsForEvent,
    });
    const published = list.filter((ev) => ev.published).length;
    const timed = list.filter((ev) => Domain.hasTimedSchedule(ev)).length;
    const otherBucket = list.filter((ev) => !ev.dayIsos.length).length;
    $('#statsView').innerHTML = `
      <div class="stats-overview">
        <div class="stats-kpi"><div class="kicker">Filtered events</div><div class="value">${list.length}</div></div>
        <div class="stats-kpi"><div class="kicker">Published</div><div class="value">${published}</div></div>
        <div class="stats-kpi"><div class="kicker">Timed</div><div class="value">${timed}</div></div>
        <div class="stats-kpi"><div class="kicker">Other / no day</div><div class="value">${otherBucket}</div></div>
      </div>
      ${statsTableHtml('Stage', 'Counts by current filtered event set.', stageSummary)}
      ${statsTableHtml('Game type', 'Events can appear in more than one game-type row.', typeSummary)}
    `;
  }

  /* ---------- Day view (single day, time × venue calendar grid) ---------- */
  const ROW_MIN = 30;
  const ROW_PX = 30;
  function renderDay(list) {
    const iso = state.day;
    const d = dayByIso[iso];
    const dayEvents = list.filter((ev) => ev.dayIsos.includes(iso));
    const timed = dayEvents.filter((ev) => Domain.hasTimedSchedule(ev));
    const untimed = dayEvents.filter((ev) => !Domain.hasTimedSchedule(ev));

    if (!timed.length) {
      $('#dayView').innerHTML = `
        <div class="day-head"><h2 class="head">${d.short}</h2><span class="dow">${d.label}</span></div>
        <p class="empty-state">No events with confirmed start times on this day.${
          untimed.length ? ` (${untimed.length} untimed/tentative — see below.)` : ''}</p>
        ${untimedBlock(untimed)}`;
      return;
    }

    // Range: clamp to the events, snapped to the half hour, min window 08:00–20:00.
    let lo = Math.min(...timed.map((e) => e.startMin));
    let hi = Math.max(...timed.map((e) => e.endMin ?? e.startMin + 60));
    lo = Math.min(Math.floor(lo / ROW_MIN) * ROW_MIN, 8 * 60);
    hi = Math.max(Math.ceil(hi / ROW_MIN) * ROW_MIN, 20 * 60);
    const rows = (hi - lo) / ROW_MIN;

    // Venues = distinct locations; blank → "Venue TBC".
    const venues = [...new Set(timed.map((e) => e.location || 'Venue TBC'))];

    // time gutter labels
    let gutter = '';
    for (let m = lo; m <= hi; m += ROW_MIN) {
      const onHour = m % 60 === 0;
      gutter += `<div class="cal-tick ${onHour ? 'hour' : ''}" style="top:${((m - lo) / ROW_MIN) * ROW_PX}px">${onHour ? fmtMin(m) : ''}</div>`;
    }

    const venueCols = venues.map((v) => {
      const evs = timed.filter((e) => (e.location || 'Venue TBC') === v);
      packLanes(evs);
      const blocks = evs.map((e) => {
        const top = ((e.startMin - lo) / ROW_MIN) * ROW_PX;
        const height = Math.max((((e.endMin ?? e.startMin + 60) - e.startMin) / ROW_MIN) * ROW_PX, 22);
        const w = 100 / e._laneCount;
        return `<div class="cal-ev" style="--sc:${STATUS_COLOR[e.status.key]};top:${top}px;height:${height}px;left:${e._lane * w}%;width:calc(${w}% - 3px)" data-id="${e._id}" title="${esc(e.title)}">
            <div class="cal-ev-time">${fmtMin(e.startMin)}${e.endMin ? '–' + fmtMin(e.endMin) : ''}</div>
            <div class="cal-ev-title">${esc(e.title)}</div>
          </div>`;
      }).join('');
      // hour gridlines
      let lines = '';
      for (let m = lo; m <= hi; m += ROW_MIN) {
        lines += `<div class="cal-line ${m % 60 === 0 ? 'hour' : ''}" style="top:${((m - lo) / ROW_MIN) * ROW_PX}px"></div>`;
      }
      return `<div class="cal-col"><header title="${esc(v)}">${esc(v)}</header>
        <div class="cal-track" style="height:${rows * ROW_PX}px">${lines}${blocks}</div></div>`;
    }).join('');

    $('#dayView').innerHTML = `
      <div class="day-head"><h2 class="head">${d.short}</h2><span class="dow">${d.label} · ${venues.length} venue${venues.length === 1 ? '' : 's'}</span></div>
      <div class="cal-grid">
        <div class="cal-gutter"><header></header><div class="cal-track" style="height:${rows * ROW_PX}px">${gutter}</div></div>
        <div class="cal-cols">${venueCols}</div>
      </div>
      ${untimedBlock(untimed)}`;
  }
  function untimedBlock(untimed) {
    if (!untimed.length) return '';
    return `<div class="cal-untimed"><h3>Untimed / tentative on this day</h3>
      <div class="untimed-cards">${untimed.map((ev) => evCardHtml(ev, state.day)).join('')}</div></div>`;
  }
  // Greedy lane assignment so overlapping events sit side by side.
  function packLanes(evs) {
    evs.sort((a, b) => a.startMin - b.startMin || (a.endMin ?? 0) - (b.endMin ?? 0));
    const laneEnds = [];
    evs.forEach((e) => {
      const end = e.endMin ?? e.startMin + 60;
      let lane = laneEnds.findIndex((le) => le <= e.startMin);
      if (lane === -1) { lane = laneEnds.length; laneEnds.push(end); } else { laneEnds[lane] = end; }
      e._lane = lane;
    });
    const count = Math.max(1, laneEnds.length);
    evs.forEach((e) => (e._laneCount = count));
  }

  /* ---------- List view (sortable) ---------- */
  function sortValue(ev, key) {
    switch (key) {
      case 'status': return STATUS_ORDER[ev.status.key];
      case 'pub': return ev.published ? 0 : 1;
      case 'title': return ev.title.toLowerCase();
      case 'organiser': return (ev.organiser || ev.organisation || '').toLowerCase();
      case 'day': return ev.dayIsos.length ? ev.dayIsos.slice().sort()[0] : '9999';
      case 'time': return ev.startMin ?? 1e9;
      case 'audience': return ev.audiences.join(', ').toLowerCase();
      case 'games': return ev.gameTypes.join(', ').toLowerCase();
      case 'location': return (ev.location || '~').toLowerCase();
      default: return '';
    }
  }
  function renderList(list) {
    const { key, dir } = state.sort;
    const sorted = list.slice().sort((a, b) => {
      const va = sortValue(a, key), vb = sortValue(b, key);
      if (va < vb) return -1 * dir; if (va > vb) return 1 * dir; return 0;
    });
    $('#listBody').innerHTML = sorted.map((ev) => `<tr data-id="${ev._id}">
      <td>${statusBadge(ev)}</td>
      <td><span class="pub-dot ${ev.published ? 'y' : 'n'}">${ev.published ? 'Y' : 'N'}</span></td>
      <td><span class="ev-title">${esc(ev.title)}</span></td>
      <td>${esc(ev.organisation || ev.organiser || '')}</td>
      <td>${esc(dayShortsFor(ev) || (ev.otherDate ? 'Other' : '—'))}${ev.confirmedTiming ? '' : ' <span class="tentative-flag">tent</span>'}</td>
      <td>${esc(listTimeLabel(ev))}</td>
      <td>${esc(ev.audiences.join(', '))}</td>
      <td>${esc(ev.gameTypes.join(', '))}</td>
      <td>${esc(ev.location || '')}</td>
    </tr>`).join('');
    $$('#listWrap th[data-sort]').forEach((th) => {
      th.classList.toggle('sorted', th.dataset.sort === key);
      th.dataset.dir = th.dataset.sort === key ? (dir === 1 ? 'asc' : 'desc') : '';
    });
  }

  /* ---------- drawer ---------- */
  const drow = (dt, dd) => (dd ? `<dt>${esc(dt)}</dt><dd>${dd}</dd>` : '');
  const dlink = (url) => (Links.hasUrl(url) ? `<a href="${esc(url)}" target="_blank" rel="noopener">${esc(url)}</a>` : '');
  function openDrawer(ev) {
    $('#drawer').innerHTML = `
      <header><h2>${esc(ev.title)}</h2><button class="close" aria-label="Close">×</button></header>
      <div class="body">
        <div class="meta-row">${statusBadge(ev)}
          <span class="pub-dot ${ev.published ? 'y' : 'n'}">${ev.published ? 'Published' : 'Not published'}</span></div>
        ${ev.thumbnail ? `<img class="thumb-prev" src="${esc(ev.thumbnail)}" alt="" onerror="this.remove()">` : ''}
        <section><h3>Schedule</h3><p class="desc">${esc(Domain.scheduleSummary(ev, dayByIso))}</p></section>
        ${ev.description ? `<section><h3>About</h3><p class="desc">${esc(ev.description)}</p></section>` : ''}
        ${ev.blurb ? `<section><h3>Marketing blurb</h3><p class="desc">${esc(ev.blurb)}</p></section>` : ''}
        <section><h3>Details</h3><dl>
          ${drow('Organisation', esc(ev.organisation))}
          ${drow('Role', esc(ev.role))}${drow('Org URL', dlink(ev.orgUrl))}${drow('Reach', esc(ev.reach))}
          ${drow('Co-organisers', esc(ev.coOrganisers))}${drow('Game types', esc(ev.gameTypes.join(', ')))}
          ${drow('Audience', esc(ev.audiences.join(', ')))}${drow('Duration', esc(ev.duration))}
          ${drow('Location', esc(ev.location))}${drow('Est. attendance', esc(ev.attendance))}
          ${drow('Max capacity', esc(ev.capacity))}${drow('Tickets / info', dlink(ev.ticketUrl))}
          ${drow('Thumbnail URL', dlink(ev.thumbnail))}
          ${drow('Submitted', esc(ev.timestamp))}
        </dl></section>
        <section><h3>Contact details</h3>
          <p class="desc">${esc("Organiser name, email, phone, and Discord aren't published to this app for privacy. Look them up in the source sheet — use the organisation and submitted-time above to find the right row.")}</p>
          <a class="chip-btn" href="${esc(SHEET_EDIT_URL)}" target="_blank" rel="noopener">Open in Google Sheet ↗</a>
        </section>
      </div>`;
    $('#drawer .close').addEventListener('click', closeDrawer);
    $('#drawer').classList.add('open');
    $('#drawer').setAttribute('aria-hidden', 'false');
    $('#backdrop').classList.add('open');
  }
  function closeDrawer() {
    $('#drawer').classList.remove('open');
    $('#drawer').setAttribute('aria-hidden', 'true');
    $('#backdrop').classList.remove('open');
  }

  /* ---------- day strip ---------- */
  const dayTab = (key, day, dow, n, active) =>
    `<button class="day-tab ${active ? 'active' : ''}" data-day="${key}">
      <span class="dt-day">${day}</span><span class="dt-dow">${dow}</span><span class="dt-cnt">${n}</span></button>`;

  function renderDayStrip() {
    const list = state.all.filter(matches);
    let html = '';
    // "All days" — Schedule view only (the calendar Day view is one day at a time).
    if (state.view === 'schedule') html += dayTab('all', 'All', 'days', list.length, state.day === 'all');
    html += CFG.FESTIVAL_DAYS.map((d) => {
      const n = list.filter((ev) => ev.dayIsos.includes(d.iso)).length;
      return dayTab(d.iso, d.short, d.dow, n, d.iso === state.day);
    }).join('');
    if (state.view === 'schedule') {
      REGIONS.forEach((rg) => {
        const n = list.filter((ev) => ev.region === rg.key).length;
        if (n) html += dayTab(rg.key, rg.tab, rg.dow, n, state.day === rg.key);
      });
    }
    $('#dayStrip').innerHTML = html;
  }

  /* ---------- main render ---------- */
  function render() {
    const list = state.all.filter(matches);
    $('#resultCount').textContent = `${list.length} of ${state.all.length} events`;
    const showStrip = state.view === 'schedule' || state.view === 'day';
    $('#dayStrip').hidden = !showStrip;
    if (showStrip) renderDayStrip();

    $('#scheduleView').hidden = state.view !== 'schedule';
    $('#dayView').hidden = state.view !== 'day';
    $('#listWrap').hidden = state.view !== 'list';
    $('#statsView').hidden = state.view !== 'stats';
    $('#emptyState').hidden = !((state.view === 'list' || state.view === 'stats') && list.length === 0);

    if (state.view === 'schedule') renderSchedule(list);
    else if (state.view === 'day') renderDay(list);
    else if (state.view === 'list') renderList(list);
    else renderStats(list);
  }

  /* ---------- filter UI ---------- */
  function buildFilterOptions() {
    if (!$('#statusToggles').children.length) {
      $('#statusToggles').innerHTML = CFG.STATUSES.map((s) =>
        `<button class="status-toggle" data-status="${s.key}" aria-pressed="true">
           <span class="dot" style="background:${STATUS_COLOR[s.key]}"></span>${esc(s.label)}</button>`).join('');
      $$('#statusToggles .status-toggle').forEach((btn) => {
        btn.addEventListener('click', () => {
          const k = btn.dataset.status, on = btn.getAttribute('aria-pressed') === 'true';
          btn.setAttribute('aria-pressed', String(!on));
          if (on) state.filters.statuses.delete(k); else state.filters.statuses.add(k);
          render();
        });
      });
    }
    const aud = new Set(), game = new Set();
    state.all.forEach((ev) => { ev.audiences.forEach((a) => aud.add(a)); ev.gameTypes.forEach((g) => game.add(g)); });
    $('#audienceSel').innerHTML = '<option value="">All audiences</option>' + [...aud].sort().map((a) => `<option>${esc(a)}</option>`).join('');
    $('#gameSel').innerHTML = '<option value="">All game types</option>' + [...game].sort().map((g) => `<option>${esc(g)}</option>`).join('');
    $('#daySel').innerHTML = '<option value="">All days</option>' +
      CFG.FESTIVAL_DAYS.map((d) => `<option value="${d.iso}">${d.label}</option>`).join('') +
      '<option value="unscheduled">Unscheduled / TBD</option>';
    $('#audienceSel').value = state.filters.audience;
    $('#gameSel').value = state.filters.game;
    $('#daySel').value = state.filters.day;
  }

  function renderSourceToggle() {
    const wrap = $('#sourceToggle');
    if (!CFG.ADMIN_SOURCE_TOGGLE_ENABLED) {
      wrap.hidden = true;
      wrap.innerHTML = '';
      return;
    }
    wrap.hidden = false;
    wrap.innerHTML = ['live', 'sample'].map((mode) =>
      `<button class="source-toggle-btn ${state.dataSourceMode === mode ? 'active' : ''}" data-source-mode="${mode}">
        ${mode === 'live' ? 'Live' : 'Sample'}
      </button>`).join('');
  }

  function wireControls() {
    $('#search').addEventListener('input', (e) => { state.filters.search = e.target.value; render(); });
    $('#audienceSel').addEventListener('change', (e) => { state.filters.audience = e.target.value; render(); });
    $('#gameSel').addEventListener('change', (e) => { state.filters.game = e.target.value; render(); });
    $('#daySel').addEventListener('change', (e) => { state.filters.day = e.target.value; render(); });
    $('#pubSel').addEventListener('change', (e) => { state.filters.pub = e.target.value; render(); });

    $('#viewSchedule').addEventListener('click', () => setView('schedule'));
    $('#viewDay').addEventListener('click', () => setView('day'));
    $('#viewList').addEventListener('click', () => setView('list'));
    $('#viewStats').addEventListener('click', () => setView('stats'));
    $('#refreshBtn').addEventListener('click', load);
    $('#themeBtn').addEventListener('click', toggleTheme);
    $('#backdrop').addEventListener('click', closeDrawer);
    $('#sourceToggle').addEventListener('click', (e) => {
      const t = e.target.closest('[data-source-mode]');
      if (!t || t.dataset.sourceMode === state.dataSourceMode) return;
      state.dataSourceMode = t.dataset.sourceMode;
      renderSourceToggle();
      load();
    });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeDrawer(); });

    $('#dayStrip').addEventListener('click', (e) => {
      const t = e.target.closest('[data-day]'); if (!t) return;
      state.day = t.dataset.day; render();
    });
    $$('#listWrap th[data-sort]').forEach((th) => {
      th.addEventListener('click', () => {
        const k = th.dataset.sort;
        if (state.sort.key === k) state.sort.dir *= -1; else state.sort = { key: k, dir: 1 };
        render();
      });
    });
    document.addEventListener('click', (e) => {
      const t = e.target.closest('[data-id]'); if (!t) return;
      const ev = state.all.find((x) => x._id === Number(t.dataset.id));
      if (ev) openDrawer(ev);
    });
  }

  function setView(v) {
    state.view = v;
    // The calendar Day view only handles a single festival day; reset if needed.
    if (v === 'day' && !dayByIso[state.day]) state.day = CFG.FESTIVAL_DAYS[0].iso;
    $('#viewSchedule').classList.toggle('active', v === 'schedule');
    $('#viewDay').classList.toggle('active', v === 'day');
    $('#viewList').classList.toggle('active', v === 'list');
    $('#viewStats').classList.toggle('active', v === 'stats');
    render();
  }
  function toggleTheme() {
    const cur = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', cur);
    try { localStorage.setItem('sgf-theme', cur); } catch (e) {}
  }

  /* ---------- load ---------- */
  async function load() {
    const oldError = $('.error-box');
    if (oldError) oldError.remove();
    $('#loading').hidden = false;
    $('#loading').textContent = 'Loading events…';
    renderSourceToggle();
    try {
      const mode = CFG.ADMIN_SOURCE_TOGGLE_ENABLED ? state.dataSourceMode : (CFG.ADMIN_DATA_SOURCE_MODE === 'sample' ? 'sample' : 'live');
      const { events, effectiveSource } = await window.SGF.loadEvents('admin', { mode });
      events.forEach((ev, i) => (ev._id = i));
      state.all = events;
      const pill = $('#sourcePill');
      pill.textContent = effectiveSource === 'sample' ? 'Sample data' : 'Live data';
      pill.className = 'source-pill ' + (effectiveSource === 'sample' ? 'sample' : 'live');
      renderSourceToggle();
      buildFilterOptions();
      $('#loading').hidden = true;
      render();
    } catch (err) {
      $('#loading').hidden = true;
      $('main').insertAdjacentHTML('afterbegin',
        `<div class="error-box">Could not load event data: ${esc(err.message || err)}</div>`);
    }
  }

  function syncTopbarHeight() {
    const h = $('.topbar').offsetHeight;
    document.documentElement.style.setProperty('--topbar-h', h + 'px');
  }

  try { const t = localStorage.getItem('sgf-theme'); if (t) document.documentElement.setAttribute('data-theme', t); } catch (e) {}
  wireControls();
  renderSourceToggle();
  syncTopbarHeight();
  window.addEventListener('resize', syncTopbarHeight);
  load();
})();
