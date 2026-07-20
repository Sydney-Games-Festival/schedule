/* SGF Schedule — Venue Map. Groups events by venue (location text), resolves
 * coordinates via the hybrid geocoder (manual override else Nominatim), and
 * plots a marker per venue with a popup listing its events. Admin-style filters
 * (status / day / published) narrow which events count. Reads the full CSV so
 * every status is visible, same as the admin page. */
(function () {
  const CFG = window.SGF_CONFIG;
  const Domain = window.SGF_DOMAIN;
  const Filters = window.SGF_FILTERS;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = (s) =>
    String(s == null ? '' : s).replace(/[&<>"']/g, (c) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  const STATUS_COLOR = {
    ideation: '#8a94a6', early: '#d98324', confirmed: '#2f8f5b', live: '#1a5fd0', unknown: '#8a94a6',
  };
  const dayByIso = Object.fromEntries(CFG.FESTIVAL_DAYS.map((d) => [d.iso, d]));
  const SYDNEY_CENTER = [-33.8688, 151.2093];

  const state = {
    all: [],
    filters: { statuses: new Set(CFG.STATUSES.map((s) => s.key)), day: '', pub: '' },
    markers: new Map(), // venue name -> L.Marker
    unmapped: [],
  };

  let map, markerLayer;

  function matches(ev) {
    return Filters.matchesMapFilters(ev, state.filters);
  }

  function timeLabel(ev) {
    const scopeIso = dayByIso[state.filters.day] ? state.filters.day : '';
    return Domain.eventTimeLabel(ev, { iso: scopeIso, includeOutsideLabel: true }) || '—';
  }
  const dayShortsFor = (ev) => Domain.dayShortsFor(ev, dayByIso, { includeOutsideLabel: true }) || 'TBD';

  function groupByVenue(list) {
    const groups = new Map();
    list.forEach((ev) => {
      const name = (ev.location || '').trim();
      if (!name) return; // can't map an event with no venue text
      if (!groups.has(name)) groups.set(name, { events: [], manual: null });
      const g = groups.get(name);
      g.events.push(ev);
      if (!g.manual && ev.venueLatLng) g.manual = ev.venueLatLng;
    });
    return groups;
  }

  function popupHtml(venueName, events) {
    const rows = events
      .sort((a, b) => (a.startMin ?? 1e9) - (b.startMin ?? 1e9))
      .map((ev) => `<div class="pop-ev">
          <span class="pop-status" style="background:${STATUS_COLOR[ev.status.key]}">${esc(ev.status.label)}</span>
          <span class="pop-name">${esc(ev.title)}</span><br>
          <span class="pop-meta">${esc(dayShortsFor(ev))} · ${esc(timeLabel(ev))}</span>
        </div>`).join('');
    return `<div class="pop-title">${esc(venueName)}</div>${rows}`;
  }

  function markerIcon(events) {
    const anyLive = events.some((e) => e.status.key === 'live');
    const color = anyLive ? STATUS_COLOR.live : STATUS_COLOR[events[0].status.key] || STATUS_COLOR.unknown;
    return L.divIcon({
      className: '', iconSize: [26, 26], iconAnchor: [13, 26], popupAnchor: [0, -24],
      html: `<div style="width:26px;height:26px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);
        background:${color};border:2px solid #fff;box-shadow:0 2px 6px rgba(16,35,63,.35)">
        <span style="position:absolute;left:50%;top:44%;transform:translate(-50%,-50%) rotate(45deg);
          color:#fff;font-size:10px;font-weight:800">${events.length}</span></div>`,
    });
  }

  async function renderMarkers() {
    markerLayer.clearLayers();
    state.markers.clear();
    state.unmapped = [];
    $('#unmappedWrap').hidden = true;

    const list = state.all.filter(matches);
    const groups = groupByVenue(list);
    const names = [...groups.keys()];
    $('#resultCount').textContent = `${list.length} of ${state.all.length} events · ${names.length} venue${names.length === 1 ? '' : 's'}`;

    if (!names.length) {
      $('#geoStatus').innerHTML = '';
      return;
    }

    let done = 0;
    const setStatus = () => {
      $('#geoStatus').innerHTML = done < names.length
        ? `<span class="spinner"></span> Locating venues… (${done}/${names.length})`
        : `${names.length} venue${names.length === 1 ? '' : 's'} located`;
    };
    setStatus();

    const bounds = [];
    for (const name of names) {
      const g = groups.get(name);
      const coords = await window.SGF.resolveVenue(name, g.manual);
      done++; setStatus();
      if (!coords) { state.unmapped.push({ name, events: g.events }); renderUnmapped(); continue; }
      const marker = L.marker([coords.lat, coords.lng], { icon: markerIcon(g.events) })
        .bindPopup(popupHtml(name, g.events));
      marker.addTo(markerLayer);
      state.markers.set(name, marker);
      bounds.push([coords.lat, coords.lng]);
      if (bounds.length === 1 || bounds.length % 4 === 0) fitIfNeeded(bounds);
    }
    fitIfNeeded(bounds);
  }
  function fitIfNeeded(bounds) {
    if (!bounds.length) return;
    if (bounds.length === 1) map.setView(bounds[0], 14);
    else map.fitBounds(bounds, { padding: [40, 40], maxZoom: 15 });
  }

  function renderUnmapped() {
    const wrap = $('#unmappedWrap');
    wrap.hidden = state.unmapped.length === 0;
    $('#unmappedList').innerHTML = state.unmapped.map((u) =>
      `<div class="venue-card"><div class="vname">${esc(u.name)}</div>
        <div class="vcount">${u.events.length} event${u.events.length === 1 ? '' : 's'}</div></div>`).join('');
  }

  /* ---- filter UI ---- */
  function buildFilterOptions() {
    $('#statusToggles').innerHTML = CFG.STATUSES.map((s) =>
      `<button class="status-toggle" data-status="${s.key}" aria-pressed="true">
         <span class="dot" style="background:${STATUS_COLOR[s.key]}"></span>${esc(s.label)}</button>`).join('');
    $$('#statusToggles .status-toggle').forEach((btn) => {
      btn.addEventListener('click', () => {
        const k = btn.dataset.status, on = btn.getAttribute('aria-pressed') === 'true';
        btn.setAttribute('aria-pressed', String(!on));
        if (on) state.filters.statuses.delete(k); else state.filters.statuses.add(k);
        renderMarkers();
      });
    });
    $('#daySel').insertAdjacentHTML('beforeend',
      CFG.FESTIVAL_DAYS.map((d) => `<option value="${d.iso}">${d.label}</option>`).join('') +
      '<option value="unscheduled">Unscheduled / TBD</option>');
    $('#daySel').addEventListener('change', (e) => { state.filters.day = e.target.value; renderMarkers(); });
    $('#pubSel').addEventListener('change', (e) => { state.filters.pub = e.target.value; renderMarkers(); });
  }

  function toggleTheme() {
    const cur = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', cur);
    try { localStorage.setItem('sgf-theme', cur); } catch (e) {}
  }

  /* ---- load ---- */
  async function load() {
    $('#leafletMap').innerHTML = '<div class="map-empty">Loading events…</div>';
    try {
      const { events, usedSample } = await window.SGF.loadEvents('admin');
      state.all = events;
      const pill = $('#sourcePill');
      pill.textContent = usedSample ? 'Sample data' : 'Live data';
      pill.className = 'source-pill ' + (usedSample ? 'sample' : 'live');

      $('#leafletMap').innerHTML = '';
      map = L.map('leafletMap').setView(SYDNEY_CENTER, 12);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      }).addTo(map);
      markerLayer = L.layerGroup().addTo(map);

      buildFilterOptions();
      await renderMarkers();
    } catch (err) {
      $('#leafletMap').innerHTML = `<div class="map-empty">Could not load event data: ${esc(err.message || err)}</div>`;
    }
  }

  $('#themeBtn').addEventListener('click', toggleTheme);
  try { const t = localStorage.getItem('sgf-theme'); if (t) document.documentElement.setAttribute('data-theme', t); } catch (e) {}
  load();
})();
