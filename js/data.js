/* SGF Schedule — shared data layer.
 * Fetches the published CSV, parses with PapaParse, and normalises each row into
 * a clean Event object. Columns are matched by header *name* (normalised), so the
 * form gaining/reordering columns does not break rendering.
 * Exposes: window.SGF.loadEvents(source)  // source = 'admin' | 'public'
 */
(function () {
  const CFG = window.SGF_CONFIG;
  const Domain = window.SGF_DOMAIN;
  const Links = window.SGF_LINKS;
  const Validation = window.SGF_VALIDATION;
  // Resolve site-relative paths (e.g. SAMPLE_CSV_URL) against the actual
  // location of THIS script, not the page — pages at different depths
  // (root vs private/) load data.js via different relative paths, but the
  // browser always resolves them to the same final script URL.
  const SITE_ROOT = new URL('..', document.currentScript.src).href;

  // Dev/testing override read from the page URL: ?data=sample or ?data=live
  // (bare ?sample also works). Only consulted when the caller hasn't forced a
  // mode — so the admin's own live/sample toggle is unaffected, but the public
  // pages (which call loadEvents with no mode) can be pointed at sample data for
  // a preview without any config change. Returns 'sample' | 'live' | null.
  function urlDataOverride() {
    try {
      if (typeof location === 'undefined') return null;
      const params = new URLSearchParams(location.search);
      const v = (params.get('data') || '').toLowerCase();
      if (v === 'sample' || v === 'live') return v;
      if (params.has('sample')) return 'sample';
      return null;
    } catch (e) {
      return null;
    }
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

  // Every page reads the same published sheet, but the returned data shape is
  // source-specific: public callers receive a program-field whitelist while
  // admin callers receive the complete parsed event object.
  async function loadEvents(source, options) {
    const liveUrl = CFG.EVENTS_CSV_URL;
    const sampleUrl = new URL(CFG.SAMPLE_CSV_URL, SITE_ROOT).href;
    let mode = options && options.mode ? options.mode : 'auto';
    // Let the URL override sample/live only when the caller left it to 'auto'.
    if (mode === 'auto') {
      const override = urlDataOverride();
      if (override) mode = override;
    }

    async function parseUrl(url) {
      const bust = (url.includes('?') ? '&' : '?') + '_=' + Date.now();
      const res = await fetchCsv(url + bust);
      const fields = (res.meta && res.meta.fields) || [];
      const hdrs = Domain.headerIndex(fields);
      const events = (res.data || [])
        .map((r) => Domain.buildEvent(r, hdrs, CFG, { links: Links, validation: Validation }))
        // drop fully-empty rows
        .filter((e) => e.title !== 'Untitled event' || e.description || e.statusRaw);
      return { events, fields };
    }

    let usedSample = false;
    let result;
    let effectiveSource = 'live';
    if (mode === 'sample') {
      usedSample = true;
      effectiveSource = 'sample';
      result = await parseUrl(sampleUrl);
    } else if (mode === 'live') {
      effectiveSource = 'live';
      result = await parseUrl(liveUrl);
    } else if (CFG.USE_SAMPLE_DATA) {
      usedSample = true;
      effectiveSource = 'sample';
      result = await parseUrl(sampleUrl);
    } else {
      try {
        result = await parseUrl(liveUrl);
        effectiveSource = 'live';
        if (!result.events.length) {
          usedSample = true;
          effectiveSource = 'sample';
          result = await parseUrl(sampleUrl);
        }
      } catch (e) {
        usedSample = true;
        effectiveSource = 'sample';
        result = await parseUrl(sampleUrl);
      }
    }
    const selectedEvents = source === 'public'
      ? result.events.map((event) => Domain.toPublicEvent(event))
      : result.events;
    return { events: selectedEvents, fields: result.fields, usedSample, effectiveSource, requestedSource: mode };
  }

  window.SGF = Object.assign(window.SGF || {}, {
    loadEvents,
    urlDataOverride,
    _norm: Domain.norm,
  });
})();
