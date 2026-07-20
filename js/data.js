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
  // Resolve site-relative paths (e.g. SAMPLE_CSV_URL) against the actual
  // location of THIS script, not the page — pages at different depths
  // (root vs private/) load data.js via different relative paths, but the
  // browser always resolves them to the same final script URL.
  const SITE_ROOT = new URL('..', document.currentScript.src).href;

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
      const hdrs = Domain.headerIndex(fields);
      const events = (res.data || [])
        .map((r) => Domain.buildEvent(r, hdrs, CFG, { links: Links }))
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
    _norm: Domain.norm,
  });
})();
