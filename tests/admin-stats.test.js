const test = require('node:test');
const assert = require('node:assert/strict');

const AdminStats = require('../js/admin-stats.js');

const CFG = {
  FESTIVAL_DAYS: [
    { iso: '2026-10-12', short: '12 OCT' },
    { iso: '2026-10-13', short: '13 OCT' },
    { iso: '2026-10-14', short: '14 OCT' },
    { iso: '2026-10-15', short: '15 OCT' },
    { iso: '2026-10-16', short: '16 OCT' },
    { iso: '2026-10-17', short: '17 OCT' },
    { iso: '2026-10-18', short: '18 OCT' },
  ],
};

test('buildSummary counts rows across festival days, before/after/TBD buckets, and unique totals', () => {
  const columns = AdminStats.defaultColumns(CFG);
  const events = [
    { status: { key: 'live' }, gameTypes: ['Board Games'], dayIsos: ['2026-10-12'], published: true },
    { status: { key: 'live' }, gameTypes: ['Board Games', 'Tabletop RPGs'], dayIsos: ['2026-10-12', '2026-10-13'], published: false },
    { status: { key: 'early' }, gameTypes: ['Tabletop RPGs'], dayIsos: [], region: AdminStats.OTHER_KEY, published: false },
    { status: { key: 'early' }, gameTypes: ['Tabletop RPGs'], dayIsos: [], region: AdminStats.BEFORE_KEY, published: false },
    { status: { key: 'live' }, gameTypes: ['Board Games'], dayIsos: [], region: AdminStats.AFTER_KEY, published: true },
  ];
  const rows = [
    { key: 'live', label: 'Live', match: (ev) => ev.status.key === 'live' },
    { key: 'early', label: 'Early', match: (ev) => ev.status.key === 'early' },
  ];

  const summary = AdminStats.buildSummary(events, columns, rows);
  const live = summary.rows.find((row) => row.key === 'live');
  const early = summary.rows.find((row) => row.key === 'early');

  assert.equal(live.counts['2026-10-12'], 2);
  assert.equal(live.counts['2026-10-13'], 1);
  assert.equal(live.counts[AdminStats.AFTER_KEY], 1);
  assert.equal(live.total, 3);
  assert.equal(early.counts[AdminStats.BEFORE_KEY], 1);
  assert.equal(early.counts[AdminStats.OTHER_KEY], 1);
  assert.equal(early.total, 2);
  assert.equal(summary.totals.counts['2026-10-12'], 2);
  assert.equal(summary.totals.counts['2026-10-13'], 1);
  assert.equal(summary.totals.counts[AdminStats.BEFORE_KEY], 1);
  assert.equal(summary.totals.counts[AdminStats.AFTER_KEY], 1);
  assert.equal(summary.totals.counts[AdminStats.OTHER_KEY], 1);
  assert.equal(summary.totals.total, 5);
});

test('eventDayBuckets keeps before/after regions separate from TBD events', () => {
  assert.deepEqual(
    AdminStats.eventDayBuckets({ dayIsos: [], region: AdminStats.BEFORE_KEY }),
    [AdminStats.BEFORE_KEY]
  );
  assert.deepEqual(
    AdminStats.eventDayBuckets({ dayIsos: [], region: AdminStats.AFTER_KEY }),
    [AdminStats.AFTER_KEY]
  );
  assert.deepEqual(
    AdminStats.eventDayBuckets({ dayIsos: [], region: AdminStats.OTHER_KEY }),
    [AdminStats.OTHER_KEY]
  );
});
