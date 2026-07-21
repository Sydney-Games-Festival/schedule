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

  // URL normalization deliberately lives in js/links.js, not here. It enforces a
  // security-relevant scheme allowlist (http/https only, so javascript:, data:
  // and mailto: are dropped), and a second copy of that rule would eventually
  // drift out of sync with the first. Callers that need to sanitise a URL use
  // SGF_LINKS.cleanUrl / SGF_LINKS.hasUrl; buildEvent receives it via options.

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
  };
});
