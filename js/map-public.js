/* SGF Schedule — Public Venue Map. Groups PUBLISHED events by venue (location
 * text), resolves coordinates via the hybrid geocoder (manual override else
 * Nominatim), and plots a marker per venue with a popup listing its events.
 * No planning-stage or publish-status filters here — this page only ever
 * shows Published = Y events, same rule as the public schedule (index.html).
 * Defaults to every venue across the whole festival; a day filter narrows it. */
(function () {
  const CFG = window.SGF_CONFIG;
  const Domain = window.SGF_DOMAIN;
  const Links = window.SGF_LINKS;
  const $ = (s, r = document) => r.querySelector(s);
  const esc = (s) =>
    String(s == null ? '' : s).replace(/[&<>"']/g, (c) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  const MARKER_COLOR = '#f5852b';
  const dayByIso = Object.fromEntries(CFG.FESTIVAL_DAYS.map((d) => [d.iso, d]));
  const SYDNEY_CENTER = [-33.8688, 151.2093];

  const state = { all: [], day: '', unmapped: [] };
  let map, markerLayer;

  function matches(ev) {
    if (!state.day) return true;
    return ev.dayIsos.includes(state.day);
  }

  function timeLabel(ev) {
    return Domain.eventTimeLabel(ev) || '—';
  }
  const dayShortsFor = (ev) => Domain.dayShortsFor(ev, dayByIso) || 'TBD';

  function groupByVenue(list) {
    const groups = new Map();
    list.forEach((ev) => {
      const name = (ev.location || '').trim();
      if (!name) return;
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
          <span class="pop-name">${esc(ev.title)}</span><br>
          <span class="pop-meta">${esc(dayShortsFor(ev))} · ${esc(timeLabel(ev))}</span>
          ${Links.hasUrl(ev.ticketUrl) ? `<br><a class="pop-link" href="${esc(ev.ticketUrl)}" target="_blank" rel="noopener">Tickets / info ↗</a>` : ''}
        </div>`).join('');
    return `<div class="pop-title">${esc(venueName)}</div>${rows}`;
  }

  function markerIcon(count) {
    return L.divIcon({
      className: '', iconSize: [26, 26], iconAnchor: [13, 26], popupAnchor: [0, -24],
      html: `<div style="width:26px;height:26px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);
        background:${MARKER_COLOR};border:2px solid #fff;box-shadow:0 2px 6px rgba(74,59,51,.35)">
        <span style="position:absolute;left:50%;top:44%;transform:translate(-50%,-50%) rotate(45deg);
          color:#fff;font-size:10px;font-weight:800">${count}</span></div>`,
    });
  }

  async function renderMarkers() {
    markerLayer.clearLayers();
    state.unmapped = [];
    $('#unmappedWrap').hidden = true;

    const list = state.all.filter(matches);
    const groups = groupByVenue(list);
    const names = [...groups.keys()];
    $('#resultCount').textContent = `${list.length} event${list.length === 1 ? '' : 's'} · ${names.length} venue${names.length === 1 ? '' : 's'}`;

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
      const marker = L.marker([coords.lat, coords.lng], { icon: markerIcon(g.events.length) })
        .bindPopup(popupHtml(name, g.events));
      marker.addTo(markerLayer);
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

  function buildFilterOptions() {
    $('#daySel').insertAdjacentHTML('beforeend',
      CFG.FESTIVAL_DAYS.map((d) => `<option value="${d.iso}">${d.label}</option>`).join(''));
    $('#daySel').addEventListener('change', (e) => { state.day = e.target.value; renderMarkers(); });
  }

  async function load() {
    $('#leafletMap').innerHTML = '<div class="map-empty">Loading events…</div>';
    try {
      const { events, usedSample } = await window.SGF.loadEvents('public');
      state.all = events.filter((e) => e.published);
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
      $('#leafletMap').innerHTML = `<div class="map-empty">Could not load event data. Please try again shortly.</div>`;
    }
  }

  load();
})();
