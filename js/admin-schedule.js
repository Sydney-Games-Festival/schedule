(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.SGF_ADMIN_SCHEDULE = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  const REGIONS = [
    { key: 'before', tab: 'Before', dow: 'pre', label: 'Before the festival' },
    { key: 'after', tab: 'After', dow: 'post', label: 'After the festival' },
    { key: 'other', tab: 'Other', dow: 'TBD', label: 'Other / date TBD' },
  ];

  function regionEventsFor(region, list) {
    return list
      .filter((ev) => ev.region === region.key)
      .sort((a, b) => (a.outsideIso || '').localeCompare(b.outsideIso || '') || (a.startMin ?? 1e9) - (b.startMin ?? 1e9));
  }

  function regionBlockHtml(region, list, options) {
    const opts = options || {};
    const esc = opts.esc || function (value) { return String(value == null ? '' : value); };
    const renderCard = opts.renderCard || function () { return ''; };
    const evs = regionEventsFor(region, list);
    if (!evs.length) return '';
    const cards = evs.map((ev) => renderCard(ev)).join('');
    return `<div class="day-block region-block">
      <div class="day-head"><h2 class="head">${esc(region.tab)}</h2><span class="dow">${esc(region.label)} · ${evs.length} event${evs.length === 1 ? '' : 's'}</span></div>
      <div class="slot-body region-body">${cards}</div></div>`;
  }

  return {
    REGIONS,
    regionBlockHtml,
    regionEventsFor,
  };
});
