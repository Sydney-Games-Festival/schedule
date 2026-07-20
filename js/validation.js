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

  function cleanUrlText(value) {
    const raw = String(value == null ? '' : value).trim();
    if (!raw) return '';

    const candidate =
      /^[a-z][a-z0-9+.-]*:/i.test(raw) ? raw :
      /^[a-z0-9.-]+\.[a-z]{2,}(?:[/:?#]|$)/i.test(raw) || /^localhost(?:[/:?#]|$)/i.test(raw)
        ? `https://${raw}`
        : raw;

    try {
      const parsed = new URL(candidate);
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return '';
      return parsed.href;
    } catch (err) {
      return '';
    }
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
