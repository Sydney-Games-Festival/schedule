(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.SGF_LINKS = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  function cleanUrl(url) {
    return String(url || '').trim();
  }

  function hasUrl(url) {
    return !!cleanUrl(url);
  }

  return {
    cleanUrl,
    hasUrl,
  };
});
