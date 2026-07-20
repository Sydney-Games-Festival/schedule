const test = require('node:test');
const assert = require('node:assert/strict');

const Domain = require('../js/domain.js');
const Filters = require('../js/filters.js');
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

const dayByIso = Object.fromEntries(CFG.FESTIVAL_DAYS.map((d) => [d.iso, d]));

function buildEvent(row) {
  const hdrs = Domain.headerIndex(Object.keys(row));
  return Domain.buildEvent(row, hdrs, CFG, { links: Links, validation: Validation });
}

test('buildEvent normalizes confirmed events from sheet-like rows', () => {
  const ev = buildEvent({
    Organisation: '  Meeple   Mates Sydney  ',
    'Event Name': 'Open Table',
    'Stage of Planning': 'Announced / Live (tickets ready)',
    Published: 'Y',
    'What type of games will be part of your event?': 'Board Games, Card Games / TCGs',
    'What type of audience are you targeting?': 'General Public, Students',
    'Where do you plan to host the event?': 'Sydney Town Hall',
    'What is the specific date being planned?': 'Sat, Oct 18',
    'What is the start time being planned?': '10:00 AM',
    'WIf known, what is the end time being planned?': '6:00 PM',
    'What URL should we direct people to? (more info, tickets)': ' https://example.com/tickets ',
    'URL to Thumbnail': ' https://example.com/thumb.jpg ',
  });

  assert.equal(ev.organisation, 'Meeple Mates Sydney');
  assert.equal(ev.title, 'Open Table');
  assert.equal(ev.status.key, 'live');
  assert.equal(ev.published, true);
  assert.deepEqual(ev.dayIsos, ['2026-10-18']);
  assert.equal(ev.startMin, 600);
  assert.equal(ev.endMin, 1080);
  assert.equal(ev.ticketUrl, 'https://example.com/tickets');
  assert.equal(ev.thumbnail, 'https://example.com/thumb.jpg');
});

test('shared validation helpers centralize cleanup for text, lists, and published flags', () => {
  assert.equal(Validation.cleanText('  Sydney   Town Hall \n'), 'Sydney Town Hall');
  assert.deepEqual(Validation.cleanList(' Board Games,  Card Games / TCGs , '), ['Board Games', 'Card Games / TCGs']);
  assert.equal(Validation.cleanPublished(' Y ', Domain.norm), true);
  assert.equal(Validation.cleanPublished('n', Domain.norm), false);
  assert.equal(Validation.cleanUrlText(' www.example.com/tickets '), 'https://www.example.com/tickets');
  assert.equal(Validation.cleanUrlText('javascript:alert(1)'), '');
  assert.equal(Links.cleanUrl('mailto:test@example.com'), '');
  assert.equal(Links.hasUrl('data:text/html,hi'), false);
});

test('parseTimeToMin extracts the actual time from spreadsheet-exported date-time values', () => {
  assert.equal(Domain.parseTimeToMin('12/30/1899 9:00:00 AM'), 540);
  assert.equal(Domain.parseTimeToMin('12/30/1899 10:00:00 PM'), 1320);
  assert.equal(Domain.parseTimeToMin('1899-12-30T22:00:00.000Z'), 1320);
  assert.equal(Domain.parseTimeToMin('0.375'), 540);
});

test('buildEvent uses parsed sheet-exported times for confirmed same-day events', () => {
  const ev = buildEvent({
    Organisation: 'All Day Example',
    'Stage of Planning': 'Confirmed Planning',
    'What is the specific date being planned?': 'Sat, Oct 17',
    'What is the start time being planned?': '12/30/1899 9:00:00 AM',
    'WIf known, what is the end time being planned?': '12/30/1899 10:00:00 PM',
  });

  assert.equal(ev.startMin, 540);
  assert.equal(ev.endMin, 1320);
});

test('grid-scheduled events with explicit times are treated as timed day schedules', () => {
  const ev = buildEvent({
    Organisation: 'All Day Example',
    'Stage of Planning': 'Early/Unconfirmed Planning',
    'If still planning, what day/time are you planning for? [Sat, Oct 17]': 'Morning, Afternoon, Evening',
    'What is the start time being planned?': '12/30/1899 9:00:00 AM',
    'WIf known, what is the end time being planned?': '12/30/1899 10:00:00 PM',
  });

  assert.equal(Domain.hasTimedSchedule(ev), true);
  assert.deepEqual([...Domain.bucketsForDay(ev, '2026-10-17')], ['AM', 'PM', 'EVE']);
  assert.equal(Domain.eventTimeLabel(ev, { iso: '2026-10-17' }), '9:00 AM – 10:00 PM');
});

test('buildEvent falls back to tentative planning-grid entries when no specific date exists', () => {
  const ev = buildEvent({
    Organisation: 'Pixel Pushers Collective',
    'Stage of Planning': 'Early/Unconfirmed Planning',
    'If still planning, what day/time are you planning for? [Thurs, Oct 15]': 'Afternoon, Evening',
    'If still planning, what day/time are you planning for? [Fri, Oct 16]': 'Morning',
    'What type of audience are you targeting?': 'Experienced Makers, Other Industry Players',
    'What type of games will be part of your event?': 'Arcade / Digital Game Cabinets',
  });

  assert.deepEqual(ev.dayIsos, ['2026-10-15', '2026-10-16']);
  assert.equal(ev.confirmedTiming, false);
  assert.deepEqual([...Domain.bucketsForDay(ev, '2026-10-15')], ['PM', 'EVE']);
  assert.deepEqual([...Domain.bucketsForDay(ev, '2026-10-16')], ['AM']);
});

test('matchFestivalDate only returns dates that actually parse inside the festival window', () => {
  assert.equal(Domain.matchFestivalDate('Mon, Oct 13', CFG), '2026-10-13');
  assert.equal(Domain.matchFestivalDate('13/10', CFG), '2026-10-13');
  assert.equal(Domain.matchFestivalDate('14 Nov 2026', CFG), null);
  assert.equal(Domain.matchFestivalDate('18/11/2026', CFG), null);
  assert.equal(Domain.matchFestivalDate('12 Sep', CFG), null);
});

test('out-of-window specific dates stay in before/after regions instead of becoming festival days', () => {
  const afterEvent = buildEvent({
    Organisation: 'Serious Play Lab',
    'Stage of Planning': 'Ideation',
    'What is the specific date being planned?': 'Possibly Sun Oct 25, morning',
  });
  const beforeEvent = buildEvent({
    Organisation: 'Sydney Tabletop Guild',
    'Stage of Planning': 'Announced / Live',
    'What is the specific date being planned?': 'Fri, Oct 9',
  });

  assert.equal(afterEvent.region, 'after');
  assert.deepEqual(afterEvent.dayIsos, []);
  assert.equal(beforeEvent.region, 'before');
  assert.deepEqual(beforeEvent.dayIsos, []);
});

test('shared presentation helpers return consistent labels', () => {
  const ev = buildEvent({
    Organisation: 'Indie Launch Pad',
    'Event Name': 'Opening Night',
    'Stage of Planning': 'Announced / Live',
    Published: 'Y',
    'What is the specific date being planned?': 'Mon, Oct 12',
    'What is the start time being planned?': '7:00 PM',
    'WIf known, what is the end time being planned?': '11:00 PM',
    'What type of audience are you targeting?': 'General Public, Experienced Makers',
  });

  assert.equal(Domain.eventTimeLabel(ev), '7:00 – 11:00 PM');
  assert.equal(Domain.headerRange([ev]), '7 - 11 PM');
  assert.equal(Domain.audienceBadge(ev), 'MAKERS');
  assert.deepEqual([...Domain.audienceBuckets(ev)].sort(), ['makers', 'players']);
});

test('eventTimeLabel can scope tentative labels to a single selected festival day', () => {
  const ev = buildEvent({
    Organisation: 'Pixel Pushers Collective',
    'Stage of Planning': 'Early/Unconfirmed Planning',
    'If still planning, what day/time are you planning for? [Thurs, Oct 15]': 'Afternoon, Evening',
    'If still planning, what day/time are you planning for? [Fri, Oct 16]': 'Morning',
  });

  assert.equal(Domain.eventTimeLabel(ev), 'Afternoon, Evening · Morning');
  assert.equal(Domain.eventTimeLabel(ev, { iso: '2026-10-15' }), 'Afternoon, Evening');
  assert.equal(Domain.eventTimeLabel(ev, { iso: '2026-10-16' }), 'Morning');
});

test('admin filters reuse shared logic for status, publication, membership, and search', () => {
  const ev = buildEvent({
    Organisation: 'Roll & Tell',
    'Event Name': 'One-Shot Night',
    'Stage of Planning': 'Confirmed Planning',
    Published: 'N',
    'What is the specific date being planned?': 'Wed, Oct 15',
    'What type of audience are you targeting?': 'Beginner Players, Experienced Players',
    'What type of games will be part of your event?': 'Tabletop RPGs',
    'Tell us about your event': 'Friendly roleplaying sessions for first-timers.',
    'Where do you plan to host the event?': 'Chatswood Library',
  });

  const filters = {
    search: 'roleplaying',
    statuses: new Set(['confirmed']),
    audience: 'Beginner Players',
    game: 'Tabletop RPGs',
    day: '2026-10-15',
    pub: 'n',
  };

  assert.equal(Filters.matchesAdminFilters(ev, filters), true);
  assert.equal(
    Filters.matchesAdminFilters(ev, Object.assign({}, filters, { search: 'megagame' })),
    false
  );
});

test('matchesDayFilter keeps before/after events out of the unscheduled bucket', () => {
  const beforeEvent = buildEvent({
    Organisation: 'Warm-Up',
    'Stage of Planning': 'Announced / Live',
    'What is the specific date being planned?': 'Fri, Oct 9',
  });
  const afterEvent = buildEvent({
    Organisation: 'Weekend Follow-Up',
    'Stage of Planning': 'Ideation',
    'What is the specific date being planned?': 'Sun Oct 25',
  });
  const otherEvent = buildEvent({
    Organisation: 'Story Forge',
    'Stage of Planning': 'Early/Unconfirmed Planning',
    'If still planning, what day/time are you planning for? [Other date]': 'Date still being decided with venue',
  });
  const blankEvent = buildEvent({
    Organisation: 'Totally TBD',
    'Stage of Planning': 'Ideation',
  });

  assert.equal(Filters.matchesDayFilter(beforeEvent, 'unscheduled'), false);
  assert.equal(Filters.matchesDayFilter(afterEvent, 'unscheduled'), false);
  assert.equal(Filters.matchesDayFilter(otherEvent, 'unscheduled'), true);
  assert.equal(Filters.matchesDayFilter(blankEvent, 'unscheduled'), true);
});

test('shared day and schedule summaries support admin and map views', () => {
  const ev = buildEvent({
    Organisation: 'Story Forge',
    'Stage of Planning': 'Early/Unconfirmed Planning',
    'If still planning, what day/time are you planning for? [Sun, Oct 18]': 'Morning',
    'If still planning, what day/time are you planning for? [Other date]': 'Date still being decided with venue',
  });

  assert.equal(Domain.dayShortsFor(ev, dayByIso), '18 OCT');
  assert.equal(Domain.scheduleSummary(ev, dayByIso), 'Tentative: 18 OCT (Morning)');
});

test('buildEvent drops unsafe URLs before any page renders them', () => {
  const ev = buildEvent({
    Organisation: 'Unsafe Links Inc',
    'Stage of Planning': 'Announced / Live',
    'Organisation URL': 'javascript:alert(1)',
    'What URL should we direct people to? (more info, tickets)': 'data:text/html,hello',
    'URL to Thumbnail': ' ftp://example.com/poster.png ',
  });

  assert.equal(ev.orgUrl, '');
  assert.equal(ev.ticketUrl, '');
  assert.equal(ev.thumbnail, '');
});
