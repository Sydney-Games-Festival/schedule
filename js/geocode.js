/* SGF Schedule — hybrid venue geocoding.
 * 1) A manual `Venue Lat/Lng` sheet column always wins (event.venueLatLng).
 * 2) Otherwise, geocode the free-text venue name via the free OpenStreetMap
 *    Nominatim API, throttled to Nominatim's usage-policy limit of 1 request/sec
 *    and cached in localStorage so each venue name is only ever looked up once
 *    across visits. (Browser fetch can't set a custom User-Agent header, so this
 *    stays within Nominatim's *light/occasional client-side use* allowance —
 *    heavy or production traffic should move to a self-hosted/paid geocoder.)
 */
(function () {
  const CACHE_KEY = 'sgf-geocode-cache-v1';
  const THROTTLE_MS = 1100;

  function loadCache() {
    try { return JSON.parse(localStorage.getItem(CACHE_KEY)) || {}; } catch (e) { return {}; }
  }
  function saveCache(cache) {
    try { localStorage.setItem(CACHE_KEY, JSON.stringify(cache)); } catch (e) {}
  }
  const cache = loadCache();

  let queue = Promise.resolve();
  function throttled(fn) {
    const run = queue.then(() => new Promise((r) => setTimeout(r, THROTTLE_MS))).then(fn);
    queue = run.catch(() => {});
    return run;
  }

  async function geocodeText(name) {
    const key = name.trim().toLowerCase();
    if (!key) return null;
    if (key in cache) return cache[key];
    const query = /sydney|nsw|australia/i.test(name) ? name : `${name}, Sydney, Australia`;
    let hit = null;
    try {
      const url = 'https://nominatim.openstreetmap.org/search?format=json&limit=1&q=' + encodeURIComponent(query);
      const res = await throttled(() => fetch(url, { headers: { Accept: 'application/json' } }));
      const data = await res.json();
      if (data && data[0]) hit = { lat: +data[0].lat, lng: +data[0].lon, source: 'geocoded' };
    } catch (e) {
      hit = null;
    }
    cache[key] = hit;
    saveCache(cache);
    return hit;
  }

  // Resolve a venue name to coordinates, preferring a manual override.
  async function resolveVenue(name, manualLatLng) {
    if (manualLatLng) return { lat: manualLatLng.lat, lng: manualLatLng.lng, source: 'manual' };
    return geocodeText(name);
  }

  window.SGF = Object.assign(window.SGF || {}, { resolveVenue });
})();
