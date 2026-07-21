const test = require('node:test');
const assert = require('node:assert/strict');

const AdminSchedule = require('../js/admin-schedule.js');
const Domain = require('../js/domain.js');
const Links = require('../js/links.js');
const Validation = require('../js/validation.js');

const CFG = {
  FESTIVAL_DAYS: [
    { iso: '2026-10-12', dow: 'Mon', short: '12 OCT', label: 'Mon 12 Oct', gridKey: 'mon' },
    { iso: '2026-10-13', dow: 'Tue', short: '13 OCT', label: 'Tue 13 Oct', gridKey: 'tue' },
    { iso: '2026-10-14', dow: 'Wed', short: '14 OCT', label: 'Wed 14 Oct', gridKey: 'wed' },
    { iso: '2026-10-15', dow: 'Thu', short: '15 OCT', label: 'Thu 15 Oct', gridKey: 'thu' },
    { iso: '2026-10-16', dow: 'Fri', short: '16 OCT', label: 'Fri 16 Oct', gridKey: 'fri' },
    { iso: '2026-10-17', dow: 'Sat', short: '17 OCT', label: 'Sat 17 Oct', gridKey: 'sat' },
    { iso: '2026-10-18', dow: 'Sun', short: '18 OCT', label: 'Sun 18 Oct', gridKey: 'sun' },
  ],
  STATUSES: [
    { key: 'ideation', label: 'Ideation', match: 'ideation' },
    { key: 'early', label: 'Early / Unconfirmed', match: 'early' },
    { key: 'confirmed', label: 'Confirmed Planning', match: 'confirmed' },
    { key: 'live', label: 'Announced / Live', match: 'announced' },
  ],
};

function buildEvent(row) {
  const hdrs = Domain.headerIndex(Object.keys(row));
  return Domain.buildEvent(row, hdrs, CFG, { links: Links, validation: Validation });
}

function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

test('fully undated events render in the admin schedule Other bucket', () => {
  const ev = buildEvent({
    'Event Name': 'Tournament',
    Organisation: 'Meeplequake',
    'Stage of Planning': 'Ideation (exploring the concept/audience/etc)',
    'Tell us about your event': 'We will host a tournament for a popular short game',
    'Where do you plan to host the event?': 'Unknown at this time',
  });

  const html = AdminSchedule.regionBlockHtml(
    AdminSchedule.REGIONS.find((region) => region.key === 'other'),
    [ev],
    {
      esc,
      renderCard: (item) => `<article>${esc(item.title)}</article>`,
    }
  );

  assert.match(html, /Other \/ date TBD/);
  assert.match(html, /Tournament/);
  assert.equal(AdminSchedule.regionEventsFor(AdminSchedule.REGIONS[2], [ev]).length, 1);
});
