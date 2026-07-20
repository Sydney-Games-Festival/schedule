(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.SGF_LINKS = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  function normalizeCandidate(raw) {
    if (!raw) return '';
    if (/^[a-z][a-z0-9+.-]*:/i.test(raw)) return raw;
    if (/^[a-z0-9.-]+\.[a-z]{2,}(?:[/:?#]|$)/i.test(raw) || /^localhost(?:[/:?#]|$)/i.test(raw)) {
      return `https://${raw}`;
    }
    return raw;
  }

  function cleanUrl(url) {
    const raw = String(url || '').trim();
    if (!raw) return '';
    try {
      const parsed = new URL(normalizeCandidate(raw));
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return '';
      return parsed.href;
    } catch (err) {
      return '';
    }
  }

  function hasUrl(url) {
    return !!cleanUrl(url);
  }

  return {
    cleanUrl,
    hasUrl,
  };
});
