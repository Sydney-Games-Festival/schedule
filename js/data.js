/* SGF Schedule — shared data layer.
 * Fetches the published CSV, parses with PapaParse, and normalises each row into
 * a clean Event object. Columns are matched by header *name* (normalised), so the
 * form gaining/reordering columns does not break rendering.
 * Exposes: window.SGF.loadEvents(source)  // source = 'admin' | 'public'
 */
(function () {
  const CFG = window.SGF_CONFIG;
  // Resolve site-relative paths (e.g. SAMPLE_CSV_URL) against the actual
  // location of THIS script, not the page — pages at different depths
  // (root vs private/) load data.js via different relative paths, but the
  // browser always resolves them to the same final script URL.
  const SITE_ROOT = new URL('..', document.currentScript.src).href;

  const norm = (s) =>
    String(s == null ? '' : s).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

  // Build a lookup: normalised header -> raw header, preserving order.
  function headerIndex(fields) {
    return fields.map((h) => ({ raw: h, n: norm(h) }));
  }

  // Return the value of the first header containing ALL given tokens.
  function pick(row, hdrs, ...tokens) {
    const toks = tokens.map(norm);
    const hit = hdrs.find((h) => toks.every((t) => h.n.includes(t)));
    return hit ? String(row[hit.raw] ?? '').trim() : '';
  }

  // "5:00 PM" / "5 pm" / "17:00" -> minutes since midnight, else null.
  function parseTimeToMin(s) {
    if (!s) return null;
    const m = String(s).trim().match(/(\d{1,2})(?::(\d{2}))?\s*(a\.?m\.?|p\.?m\.?)?/i);
    if (!m) return null;
    let h = +m[1];
    const min = m[2] ? +m[2] : 0;
    if (h > 23 || min > 59) return null;
    const ap = m[3] ? m[3].toLowerCase().replace(/\./g, '') : '';
    if (ap === 'pm' && h < 12) h += 12;
    if (ap === 'am' && h === 12) h = 0;
    return h * 60 + min;
  }

  // "6 hours" / "90 mins" / "1.5 hrs" -> minutes, else null.
  function parseDurationToMin(s) {
    if (!s) return null;
    const t = String(s).toLowerCase();
    const hM = t.match(/(\d+(?:\.\d+)?)\s*(h|hr|hrs|hour|hours)/);
    const mM = t.match(/(\d+)\s*(m|min|mins|minute|minutes)/);
    let total = 0, matched = false;
    if (hM) { total += parseFloat(hM[1]) * 60; matched = true; }
    if (mM) { total += parseInt(mM[1], 10); matched = true; }
    return matched ? Math.round(total) : null;
  }

  // "-33.87, 151.20" -> { lat, lng } (manual venue coordinates), else null.
  function parseLatLng(s) {
    if (!s) return null;
    const m = String(s).match(/(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)/);
    if (!m) return null;
    const lat = +m[1], lng = +m[2];
    if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
    return { lat, lng };
  }

  const splitList = (v) =>
    String(v || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

  function statusInfo(raw) {
    const n = norm(raw);
    const found = CFG.STATUSES.find((s) => n.includes(s.match));
    return found || { key: 'unknown', label: raw || 'Unknown', match: '' };
  }

  const FEST_FIRST = CFG.FESTIVAL_DAYS[0].iso;
  const FEST_LAST = CFG.FESTIVAL_DAYS[CFG.FESTIVAL_DAYS.length - 1].iso;
  const MONTHS = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 };
  const isoOf = (d) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

  // Best-effort parse of free-text dates ("Oct 25", "25 Oct", "25/10", ISO, etc.).
  // Year defaults to the festival year when absent. Returns { date, iso } or null.
  function parseAnyDate(text) {
    if (!text) return null;
    const t = String(text);
    const yr = +FEST_FIRST.slice(0, 4);
    let m = t.match(/(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (m) { const d = new Date(+m[1], +m[2] - 1, +m[3]); return { date: d, iso: isoOf(d) }; }
    m = t.match(/([a-z]{3,9})\.?\s+(\d{1,2})/i);
    if (m && MONTHS[m[1].slice(0, 3).toLowerCase()] != null) {
      const d = new Date(yr, MONTHS[m[1].slice(0, 3).toLowerCase()], +m[2]); return { date: d, iso: isoOf(d) };
    }
    m = t.match(/(\d{1,2})\s+([a-z]{3,9})/i);
    if (m && MONTHS[m[2].slice(0, 3).toLowerCase()] != null) {
      const d = new Date(yr, MONTHS[m[2].slice(0, 3).toLowerCase()], +m[1]); return { date: d, iso: isoOf(d) };
    }
    m = t.match(/(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?/);
    if (m) { const y = m[3] ? (+m[3] < 100 ? 2000 + +m[3] : +m[3]) : yr; const d = new Date(y, +m[2] - 1, +m[1]); return { date: d, iso: isoOf(d) }; }
    const p = Date.parse(t);
    if (!isNaN(p)) { const d = new Date(p); return { date: d, iso: isoOf(d) }; }
    return null;
  }

  // Map a free-text "specific date" to a festival ISO date, else null.
  function matchFestivalDate(text) {
    const n = norm(text);
    if (!n) return null;
    // Prefer an explicit day number that sits in the festival range.
    for (const d of CFG.FESTIVAL_DAYS) {
      const dayNum = d.iso.slice(-2).replace(/^0/, ''); // "12".."18"
      // require the number as a standalone token to avoid matching e.g. "120"
      const tokenRe = new RegExp('(^|[^0-9])' + dayNum + '([^0-9]|$)');
      if (tokenRe.test(n)) return d.iso;
    }
    // Fallback: native parse, then map if it lands in the week.
    const t = Date.parse(text);
    if (!isNaN(t)) {
      const iso = new Date(t).toISOString().slice(0, 10);
      if (CFG.FESTIVAL_DAYS.some((d) => d.iso === iso)) return iso;
    }
    return null;
  }

  function buildSchedule(row, hdrs) {
    const specific = pick(row, hdrs, 'specific date');
    const startTime = pick(row, hdrs, 'start time');
    const endTime = pick(row, hdrs, 'end time');

    const otherDate = pick(row, hdrs, 'still planning', 'other');
    const base = { entries: [], specificRaw: specific, otherDate, region: null, outsideIso: '', outsideLabel: '' };

    // 1) Confirmed specific date within the festival window.
    const specificIso = matchFestivalDate(specific);
    if (specificIso) {
      base.entries = [{ iso: specificIso, tentative: false, slot: '', startTime, endTime }];
      return base;
    }

    // 2) Planning grid: per-day Morning/Afternoon/Evening (in-window).
    for (const d of CFG.FESTIVAL_DAYS) {
      const dayNum = d.iso.slice(-2).replace(/^0/, '');
      const val = pick(row, hdrs, 'still planning', 'oct ' + dayNum);
      if (val) base.entries.push({ iso: d.iso, tentative: true, slot: val, startTime, endTime });
    }
    if (base.entries.length) return base;

    // 3) Out-of-window: a real date that parses before/after the festival, or an
    //    unparseable "other date" note → generic catch-all.
    const parsed = parseAnyDate(specific) || parseAnyDate(otherDate);
    if (parsed) {
      base.outsideIso = parsed.iso;
      base.outsideLabel = parsed.date.toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
      base.region = parsed.iso < FEST_FIRST ? 'before' : parsed.iso > FEST_LAST ? 'after' : null;
      // A parsed date that lands inside the window but wasn't caught above (rare) → treat as after.
      if (!base.region) base.region = 'after';
    } else if (specific || otherDate) {
      base.region = 'other';
      base.outsideLabel = specific || otherDate;
    }
    return base;
  }

  function normaliseRow(row, hdrs) {
    const organisation = pick(row, hdrs, 'organisation');
    const eventName = pick(row, hdrs, 'event name');
    const sched = buildSchedule(row, hdrs);
    const publishedRaw = pick(row, hdrs, 'published');

    const startTime = pick(row, hdrs, 'start time');
    const endTime = pick(row, hdrs, 'end time');
    const duration = pick(row, hdrs, 'how long', 'duration') || pick(row, hdrs, 'duration');
    const startMin = parseTimeToMin(startTime);
    let endMin = parseTimeToMin(endTime);
    if (startMin != null && endMin == null) {
      const durMin = parseDurationToMin(duration);
      if (durMin) endMin = startMin + durMin;
    }
    if (startMin != null && endMin != null && endMin <= startMin) endMin = startMin + 60;

    return {
      // identity
      title: eventName || organisation || 'Untitled event',
      hasRealName: !!eventName,
      organisation,
      organiser: pick(row, hdrs, 'name'),
      role: pick(row, hdrs, 'role'),
      orgUrl: pick(row, hdrs, 'organisation url'),
      reach: pick(row, hdrs, 'reaches'),
      coOrganisers: pick(row, hdrs, 'who else'),

      // status / publish
      status: statusInfo(pick(row, hdrs, 'stage of planning')),
      statusRaw: pick(row, hdrs, 'stage of planning'),
      published: /^y/.test(norm(publishedRaw)),
      publishedRaw,

      // Contact fields (Name/Email/Mobile/Discord/Alt Contact) are intentionally
      // excluded from the published sheet, so these are always empty in
      // practice — kept here so the app still behaves if that ever changes.
      // Admin looks up contacts directly in the source Google Sheet instead
      // (see SHEET_EDIT_URL in js/admin.js).
      email: pick(row, hdrs, 'email'),
      mobile: pick(row, hdrs, 'mobile'),
      discord: pick(row, hdrs, 'discord'),
      altContact: pick(row, hdrs, 'alternate contact'),

      // about
      description: pick(row, hdrs, 'tell us about'),
      blurb: pick(row, hdrs, 'marketing blurb'),
      gameTypes: splitList(pick(row, hdrs, 'type of games')),
      audiences: splitList(pick(row, hdrs, 'type of audience')),

      // logistics
      duration,
      location: pick(row, hdrs, 'where do you plan'),
      // Optional manual override for the map (e.g. "-33.8688, 151.2093"); wins
      // over client-side geocoding of `location` when present. See js/geocode.js.
      venueLatLng: parseLatLng(pick(row, hdrs, 'venue', 'lat')),
      attendance: pick(row, hdrs, 'estimated attendance'),
      capacity: pick(row, hdrs, 'max capacity'),
      ticketUrl: pick(row, hdrs, 'what url should we direct'),
      thumbnail: pick(row, hdrs, 'url to thumbnail'),

      // timing
      timestamp: pick(row, hdrs, 'timestamp'),
      startTime,
      endTime,
      startMin,
      endMin,
      timeText: startTime ? (endTime ? `${startTime}–${endTime}` : startTime) : '',

      // out-of-window catch-all: region = 'before' | 'after' | 'other' | null
      region: sched.region,
      outsideIso: sched.outsideIso,
      outsideLabel: sched.outsideLabel,
      specificDateRaw: sched.specificRaw,
      otherDate: sched.otherDate,

      // computed schedule
      schedule: sched.entries, // [{iso, tentative, slot, startTime, endTime}]
      dayIsos: [...new Set(sched.entries.map((e) => e.iso))],
      scheduled: sched.entries.length > 0,
      confirmedTiming: sched.entries.some((e) => !e.tentative),
    };
  }

  async function fetchCsv(url) {
    return new Promise((resolve, reject) => {
      Papa.parse(url, {
        download: true,
        header: true,
        skipEmptyLines: 'greedy',
        complete: (res) => resolve(res),
        error: reject,
      });
    });
  }

  // `source` is accepted for readability at call sites (loadEvents('admin') /
  // loadEvents('public')) but every page reads the SAME sheet now — there is
  // no separate contact-containing CSV any more. See CFG.EVENTS_CSV_URL.
  async function loadEvents(source) {
    const liveUrl = CFG.EVENTS_CSV_URL;
    const sampleUrl = new URL(CFG.SAMPLE_CSV_URL, SITE_ROOT).href;

    async function parseUrl(url) {
      const bust = (url.includes('?') ? '&' : '?') + '_=' + Date.now();
      const res = await fetchCsv(url + bust);
      const fields = (res.meta && res.meta.fields) || [];
      const hdrs = headerIndex(fields);
      const events = (res.data || [])
        .map((r) => normaliseRow(r, hdrs))
        // drop fully-empty rows
        .filter((e) => e.title !== 'Untitled event' || e.description || e.statusRaw);
      return { events, fields };
    }

    let usedSample = false;
    let result;
    if (CFG.USE_SAMPLE_DATA) {
      usedSample = true;
      result = await parseUrl(sampleUrl);
    } else {
      try {
        result = await parseUrl(liveUrl);
        if (!result.events.length) {
          usedSample = true;
          result = await parseUrl(sampleUrl);
        }
      } catch (e) {
        usedSample = true;
        result = await parseUrl(sampleUrl);
      }
    }
    return { events: result.events, fields: result.fields, usedSample };
  }

  window.SGF = Object.assign(window.SGF || {}, {
    loadEvents,
    _norm: norm,
  });
})();
