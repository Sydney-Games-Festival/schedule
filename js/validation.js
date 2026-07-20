(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.SGF_VALIDATION = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  function cleanText(value) {
    return String(value == null ? '' : value).replace(/\s+/g, ' ').trim();
  }

  // Like cleanText, but keeps line breaks — for long-text fields (description,
  // marketing blurb) that render in white-space: pre-wrap containers, where
  // collapsing newlines would flatten paragraphs into one block.
  function cleanMultiline(value) {
    return String(value == null ? '' : value)
      .replace(/\r\n?/g, '\n')          // normalise CRLF / CR to LF
      .replace(/[^\S\n]+/g, ' ')        // collapse runs of spaces/tabs, keep newlines
      .replace(/[ \t]*\n[ \t]*/g, '\n') // trim horizontal space around each break
      .replace(/\n{3,}/g, '\n\n')       // cap blank-line runs at one
      .trim();
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
    cleanMultiline,
    cleanPublished,
    cleanText,
    cleanUrlText,
  };
});
