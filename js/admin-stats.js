(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.SGF_ADMIN_STATS = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  const BEFORE_KEY = 'before';
  const AFTER_KEY = 'after';
  const OTHER_KEY = 'other';

  function defaultColumns(cfg) {
    return cfg.FESTIVAL_DAYS.map((d) => ({ key: d.iso, label: d.short }))
      .concat(
        { key: BEFORE_KEY, label: 'Before' },
        { key: AFTER_KEY, label: 'After' },
        { key: OTHER_KEY, label: 'TBD' }
      );
  }

  function eventDayBuckets(ev) {
    if (ev.dayIsos.length) return ev.dayIsos;
    if (ev.region === BEFORE_KEY || ev.region === AFTER_KEY || ev.region === OTHER_KEY) return [ev.region];
    return [OTHER_KEY];
  }

  function emptyCounts(columns) {
    return Object.fromEntries(columns.map((col) => [col.key, 0]));
  }

  function buildSummary(events, columns, rowDefs, options) {
    const opts = options || {};
    const bucketsForEvent = opts.bucketsForEvent || eventDayBuckets;
    const keepZeroRows = !!opts.keepZeroRows;
    const rows = rowDefs.map((row) => ({
      key: row.key,
      label: row.label,
      match: row.match,
      counts: emptyCounts(columns),
      total: 0,
    }));
    const totals = { counts: emptyCounts(columns), total: events.length };

    events.forEach((ev) => {
      const buckets = bucketsForEvent(ev).filter((bucket) => bucket in totals.counts);
      buckets.forEach((bucket) => { totals.counts[bucket] += 1; });
      rows.forEach((row) => {
        if (!row.match(ev)) return;
        row.total += 1;
        buckets.forEach((bucket) => { row.counts[bucket] += 1; });
      });
    });

    return {
      columns,
      rows: keepZeroRows ? rows : rows.filter((row) => row.total > 0),
      totals,
    };
  }

  return {
    AFTER_KEY,
    BEFORE_KEY,
    OTHER_KEY,
    buildSummary,
    defaultColumns,
    eventDayBuckets,
  };
});
