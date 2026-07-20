(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.SGF_VALIDATION = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  function cleanText(value) {
    return String(value == null ? '' : value).replace(/\s+/g, ' ').trim();
  }

  function cleanList(value) {
    const text = cleanText(value);
    if (!text) return [];
    return text.split(',').map((item) => cleanText(item)).filter(Boolean);
  }

  function cleanLocation(value) {
    return cleanText(value);
  }

  // Intentionally keeps URL handling permissive for now; the link-safety bug is
  // fixed separately after the shared validation boundary is in place.
  function cleanUrlText(value) {
    return String(value == null ? '' : value).trim();
  }

  function cleanPublished(value, norm) {
    const normalize = typeof norm === 'function'
      ? norm
      : function (s) { return String(s == null ? '' : s).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim(); };
    return /^y/.test(normalize(value));
  }

  return {
    cleanList,
    cleanLocation,
    cleanPublished,
    cleanText,
    cleanUrlText,
  };
});
