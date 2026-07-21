(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.SGF_DOMAIN = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  const MONTHS = {
    jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
    jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
  };

  const AUDIENCE_BUCKET_MAP = {
    'general public': 'players',
    'beginner players': 'players',
    'experienced players': 'players',
    'beginner makers': 'makers',
    'experienced makers': 'makers',
    'other industry players': 'makers',
    students: 'learners',
    academics: 'learners',
  };

  function norm(s) {
    return String(s == null ? '' : s).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  }

  function headerIndex(fields) {
    return fields.map((h) => ({ raw: h, n: norm(h) }));
  }

  function pick(row, hdrs) {
    const tokens = Array.prototype.slice.call(arguments, 2).map(norm);
    const hit = hdrs.find((h) => tokens.every((t) => h.n.includes(t)));
    return hit ? String(row[hit.raw] ?? '').trim() : '';
  }

  function splitList(v) {
    return String(v || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
  }

  function parseTimeToMin(s) {
    if (!s) return null;
    const raw = String(s).trim();
    if (!raw) return null;

    const numeric = Number(raw);
    if (!isNaN(numeric) && numeric >= 0 && numeric < 1) {
      return Math.round(numeric * 24 * 60);
    }

    const timeMatches = [...raw.matchAll(/(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(a\.?m\.?|p\.?m\.?)?/ig)];
    const meridiemOnlyMatches = timeMatches.length ? [] : [...raw.matchAll(/\b(\d{1,2})\s*(a\.?m\.?|p\.?m\.?)\b/ig)];
    const m = timeMatches.length ? timeMatches[timeMatches.length - 1] : meridiemOnlyMatches[meridiemOnlyMatches.length - 1];
    if (!m) return null;

    let h = +m[1];
    const min = m[2] ? +m[2] : 0;
    if (h > 23 || min > 59) return null;
    const apIndex = timeMatches.length ? 4 : 2;
    const ap = m[apIndex] ? m[apIndex].toLowerCase().replace(/\./g, '') : '';
    if (ap === 'pm' && h < 12) h += 12;
    if (ap === 'am' && h === 12) h = 0;
    return h * 60 + min;
  }

  function parseDurationToMin(s) {
    if (!s) return null;
    const t = String(s).toLowerCase();
    const hM = t.match(/(\d+(?:\.\d+)?)\s*(h|hr|hrs|hour|hours)/);
    const mM = t.match(/(\d+)\s*(m|min|mins|minute|minutes)/);
    let total = 0;
    let matched = false;
    if (hM) {
      total += parseFloat(hM[1]) * 60;
      matched = true;
    }
    if (mM) {
      total += parseInt(mM[1], 10);
      matched = true;
    }
    return matched ? Math.round(total) : null;
  }

  function parseLatLng(s) {
    if (!s) return null;
    const m = String(s).match(/(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)/);
    if (!m) return null;
    const lat = +m[1];
    const lng = +m[2];
    if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
    return { lat, lng };
  }

  function festivalBounds(cfg) {
    const first = cfg.FESTIVAL_DAYS[0].iso;
    const last = cfg.FESTIVAL_DAYS[cfg.FESTIVAL_DAYS.length - 1].iso;
    return { first, last, year: +first.slice(0, 4) };
  }

  function statusInfo(raw, cfg) {
    const n = norm(raw);
    const found = cfg.STATUSES.find((s) => n.includes(s.match));
    return found || { key: 'unknown', label: raw || 'Unknown', match: '' };
  }

  function isoOf(d) {
    return [
      d.getFullYear(),
      String(d.getMonth() + 1).padStart(2, '0'),
      String(d.getDate()).padStart(2, '0'),
    ].join('-');
  }

  function parseAnyDate(text, cfg) {
    if (!text) return null;
    const t = String(text);
    const year = festivalBounds(cfg).year;
    let m = t.match(/(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (m) {
      const d = new Date(+m[1], +m[2] - 1, +m[3]);
      return { date: d, iso: isoOf(d) };
    }

    m = t.match(/([a-z]{3,9})\.?\s+(\d{1,2})/i);
    if (m && MONTHS[m[1].slice(0, 3).toLowerCase()] != null) {
      const d = new Date(year, MONTHS[m[1].slice(0, 3).toLowerCase()], +m[2]);
      return { date: d, iso: isoOf(d) };
    }

    m = t.match(/(\d{1,2})\s+([a-z]{3,9})/i);
    if (m && MONTHS[m[2].slice(0, 3).toLowerCase()] != null) {
      const d = new Date(year, MONTHS[m[2].slice(0, 3).toLowerCase()], +m[1]);
      return { date: d, iso: isoOf(d) };
    }

    m = t.match(/(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?/);
    if (m) {
      const a = +m[1];
      const b = +m[2];
      const y = m[3] ? (+m[3] < 100 ? 2000 + +m[3] : +m[3]) : year;
      // Google Sheets exports dates as US M/D/YYYY, so default to month-first.
      // A value > 12 can only be the day, which resolves the day-first case
      // (e.g. "13/10" -> 13 Oct); when both are <= 12 it is genuinely ambiguous
      // so we keep the sheet's month-first locale (e.g. "10/12" -> 12 Oct).
      let month = a;
      let day = b;
      if (a > 12 && b <= 12) { month = b; day = a; }
      const d = new Date(y, month - 1, day);
      return { date: d, iso: isoOf(d) };
    }

    const parsed = Date.parse(t);
    if (!isNaN(parsed)) {
      const d = new Date(parsed);
      return { date: d, iso: isoOf(d) };
    }
    return null;
  }

  function matchFestivalDate(text, cfg) {
    const parsed = parseAnyDate(text, cfg);
    if (!parsed) return null;
    const bounds = festivalBounds(cfg);
    return parsed.iso >= bounds.first && parsed.iso <= bounds.last ? parsed.iso : null;
  }

  function buildSchedule(row, hdrs, cfg, validation) {
    const cleanText = validation && typeof validation.cleanText === 'function'
      ? validation.cleanText
      : function (value) { return String(value == null ? '' : value).trim(); };
    const specific = cleanText(pick(row, hdrs, 'specific date'));
    const startTime = cleanText(pick(row, hdrs, 'start time'));
    const endTime = cleanText(pick(row, hdrs, 'end time'));
    const otherDate = cleanText(pick(row, hdrs, 'still planning', 'other'));
    const base = {
      entries: [],
      specificRaw: specific,
      otherDate,
      region: null,
      outsideIso: '',
      outsideLabel: '',
    };

    const specificIso = matchFestivalDate(specific, cfg);
    if (specificIso) {
      base.entries = [{ iso: specificIso, tentative: false, slot: '', startTime, endTime }];
      return base;
    }

    for (const d of cfg.FESTIVAL_DAYS) {
      const dayNum = d.iso.slice(-2).replace(/^0/, '');
      const val = cleanText(pick(row, hdrs, 'still planning', 'oct ' + dayNum));
      if (val) base.entries.push({ iso: d.iso, tentative: true, slot: val, startTime, endTime });
    }
    if (base.entries.length) return base;

    const parsed = parseAnyDate(specific, cfg) || parseAnyDate(otherDate, cfg);
    if (parsed) {
      const bounds = festivalBounds(cfg);
      base.outsideIso = parsed.iso;
      base.outsideLabel = parsed.date.toLocaleDateString('en-AU', {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      });
      base.region = parsed.iso < bounds.first ? 'before' : parsed.iso > bounds.last ? 'after' : null;
      if (!base.region) base.region = 'after';
    } else if (specific || otherDate) {
      base.region = 'other';
      base.outsideLabel = specific || otherDate;
    }
    return base;
  }

  function buildEvent(row, hdrs, cfg, options) {
    const links = options && options.links;
    const validation = options && options.validation;
    const cleanText = validation && typeof validation.cleanText === 'function'
      ? validation.cleanText
      : function (value) { return String(value == null ? '' : value).trim(); };
    const cleanMultiline = validation && typeof validation.cleanMultiline === 'function'
      ? validation.cleanMultiline
      : cleanText;
    const cleanList = validation && typeof validation.cleanList === 'function'
      ? validation.cleanList
      : splitList;
    const cleanLocation = validation && typeof validation.cleanLocation === 'function'
      ? validation.cleanLocation
      : cleanText;
    const cleanPublished = validation && typeof validation.cleanPublished === 'function'
      ? function (value) { return validation.cleanPublished(value, norm); }
      : function (value) { return /^y/.test(norm(value)); };
    // Single source of URL sanitisation (see js/links.js). Fails closed: without
    // the links module we drop the URL rather than render an unvalidated one,
    // since this is what keeps javascript:/data: URLs out of the pages.
    const cleanUrl = links && typeof links.cleanUrl === 'function'
      ? links.cleanUrl
      : function () { return ''; };
    const organisation = cleanText(pick(row, hdrs, 'organisation'));
    const eventName = cleanText(pick(row, hdrs, 'event name'));
    const sched = buildSchedule(row, hdrs, cfg, validation);
    const publishedRaw = cleanText(pick(row, hdrs, 'published'));
    const startTime = cleanText(pick(row, hdrs, 'start time'));
    const endTime = cleanText(pick(row, hdrs, 'end time'));
    const duration = cleanText(pick(row, hdrs, 'how long', 'duration') || pick(row, hdrs, 'duration'));
    const startMin = parseTimeToMin(startTime);
    let endMin = parseTimeToMin(endTime);

    if (startMin != null && endMin == null) {
      const durMin = parseDurationToMin(duration);
      if (durMin) endMin = startMin + durMin;
    }
    if (startMin != null && endMin != null && endMin <= startMin) endMin = startMin + 60;

    return {
      title: eventName || organisation || 'Untitled event',
      hasRealName: !!eventName,
      organisation,
      organiser: cleanText(pick(row, hdrs, 'name')),
      role: cleanText(pick(row, hdrs, 'role')),
      orgUrl: cleanUrl(pick(row, hdrs, 'organisation url')),
      reach: cleanText(pick(row, hdrs, 'reaches')),
      coOrganisers: cleanText(pick(row, hdrs, 'who else')),

      status: statusInfo(pick(row, hdrs, 'stage of planning'), cfg),
      statusRaw: pick(row, hdrs, 'stage of planning'),
      published: cleanPublished(publishedRaw),
      publishedRaw,

      email: cleanText(pick(row, hdrs, 'email')),
      mobile: cleanText(pick(row, hdrs, 'mobile')),
      discord: cleanText(pick(row, hdrs, 'discord')),
      altContact: cleanText(pick(row, hdrs, 'alternate contact')),

      description: cleanMultiline(pick(row, hdrs, 'tell us about')),
      blurb: cleanMultiline(pick(row, hdrs, 'marketing blurb')),
      gameTypes: cleanList(pick(row, hdrs, 'type of games')),
      audiences: cleanList(pick(row, hdrs, 'type of audience')),

      duration,
      location: cleanLocation(pick(row, hdrs, 'where do you plan')),
      venueLatLng: parseLatLng(pick(row, hdrs, 'venue', 'lat')),
      attendance: cleanText(pick(row, hdrs, 'estimated attendance')),
      capacity: cleanText(pick(row, hdrs, 'max capacity')),
      ticketUrl: cleanUrl(pick(row, hdrs, 'what url should we direct')),
      thumbnail: cleanUrl(pick(row, hdrs, 'url to thumbnail')),

      timestamp: cleanText(pick(row, hdrs, 'timestamp')),
      startTime,
      endTime,
      startMin,
      endMin,
      timeText: startTime ? (endTime ? `${startTime}–${endTime}` : startTime) : '',

      region: sched.region,
      outsideIso: sched.outsideIso,
      outsideLabel: sched.outsideLabel,
      specificDateRaw: sched.specificRaw,
      otherDate: sched.otherDate,

      schedule: sched.entries,
      dayIsos: [...new Set(sched.entries.map((e) => e.iso))],
      scheduled: sched.entries.length > 0,
      confirmedTiming: sched.entries.some((e) => !e.tentative),
    };
  }

  function parts(m) {
    let h = Math.floor(m / 60);
    const min = m % 60;
    const ap = h >= 12 ? 'PM' : 'AM';
    h = h % 12;
    if (h === 0) h = 12;
    return {
      hm: min ? `${h}:${String(min).padStart(2, '0')}` : `${h}:00`,
      hour: String(h),
      ap,
      min,
    };
  }

  function getScheduleEntry(ev, iso) {
    return ev.schedule.find((e) => e.iso === iso) || null;
  }

  function tentativeSlots(ev, iso) {
    const source = iso ? ev.schedule.filter((e) => e.iso === iso) : ev.schedule;
    return [...new Set(source.filter((e) => e.tentative && e.slot).map((e) => e.slot))];
  }

  function eventTimeLabel(ev, options) {
    const opts = options || {};
    if (ev.startMin != null) {
      const s = parts(ev.startMin);
      if (ev.endMin != null) {
        const e = parts(ev.endMin);
        return s.ap === e.ap ? `${s.hm} – ${e.hm} ${e.ap}` : `${s.hm} ${s.ap} – ${e.hm} ${e.ap}`;
      }
      return `${s.hm} ${s.ap}`;
    }
    const slots = tentativeSlots(ev, opts.iso);
    if (slots.length) return slots.join(' · ');
    return opts.includeOutsideLabel && ev.outsideLabel ? ev.outsideLabel : '';
  }

  function formatClock(m, options) {
    const opts = options || {};
    const p = parts(m);
    const ap = opts.lowercase ? p.ap.toLowerCase() : p.ap;
    const gap = opts.spaceBeforeMeridiem === false ? '' : ' ';
    return `${p.hm}${gap}${ap}`;
  }

  function eventTimeRangeLabel(ev, options) {
    const opts = options || {};
    if (ev.startMin == null) return '';
    if (ev.endMin != null) {
      return `${formatClock(ev.startMin, opts)}${opts.separator || ' – '}${formatClock(ev.endMin, opts)}`;
    }
    return formatClock(ev.startMin, opts);
  }

  function eventEndMin(ev) {
    if (ev.endMin != null) return ev.endMin;
    if (ev.startMin != null) return ev.startMin + 60;
    return null;
  }

  function hasTimedSchedule(ev) {
    return ev.startMin != null && ev.dayIsos.length > 0;
  }

  function headerRange(evs) {
    const timed = evs.filter((e) => e.startMin != null);
    if (!timed.length) return '';
    const lo = parts(Math.min(...timed.map((e) => e.startMin)));
    const hiVals = timed.map((e) => e.endMin ?? e.startMin);
    const hi = parts(Math.max(...hiVals));
    const l = lo.min ? lo.hm : lo.hour;
    const h = hi.min ? hi.hm : hi.hour;
    return lo.ap === hi.ap ? `${l} - ${h} ${hi.ap}` : `${l} ${lo.ap} - ${h} ${hi.ap}`;
  }

  function audienceBadge(ev) {
    const a = ev.audiences.join(' ').toLowerCase();
    if (a.includes('maker')) return 'MAKERS';
    if (a.includes('industry')) return 'INDUSTRY';
    if (a.includes('academic')) return 'ACADEMICS';
    if (a.includes('student')) return 'STUDENTS';
    if (a.includes('player')) return 'PLAYERS';
    if (a.includes('public')) return 'PUBLIC';
    return ev.audiences[0] ? ev.audiences[0].toUpperCase() : '';
  }

  function audienceBuckets(ev) {
    const buckets = new Set();
    ev.audiences.forEach((raw) => {
      const bucket = AUDIENCE_BUCKET_MAP[raw.toLowerCase().trim()];
      if (bucket) buckets.add(bucket);
    });
    return buckets;
  }

  function bucketsForDay(ev, iso) {
    const entry = getScheduleEntry(ev, iso);
    const out = new Set();
    if (entry && hasTimedSchedule(ev)) {
      const start = ev.startMin;
      const end = eventEndMin(ev);
      if (start != null && end != null) {
        if (start < 12 * 60 && end > 0) out.add('AM');
        if (start < 17 * 60 && end > 12 * 60) out.add('PM');
        if (end > 17 * 60) out.add('EVE');
      }
    } else if (entry && entry.slot) {
      const s = entry.slot.toLowerCase();
      if (s.includes('morning')) out.add('AM');
      if (s.includes('afternoon')) out.add('PM');
      if (s.includes('evening')) out.add('EVE');
    }
    if (!out.size) out.add('AM');
    return out;
  }

  function dayShortsFor(ev, dayByIso, options) {
    const opts = options || {};
    const text = ev.dayIsos
      .map((iso) => (dayByIso[iso] ? dayByIso[iso].short : iso))
      .join(', ');
    if (text) return text;
    return opts.includeOutsideLabel && ev.outsideLabel ? ev.outsideLabel : '';
  }

  function scheduleSummary(ev, dayByIso) {
    if (ev.confirmedTiming) {
      const d = dayByIso[ev.dayIsos[0]];
      const t = ev.startTime ? (ev.endTime ? `${ev.startTime}–${ev.endTime}` : ev.startTime) : '';
      return `Confirmed: ${d ? d.label : ev.dayIsos[0]}${t ? ' · ' + t : ''}`;
    }
    if (ev.schedule.length) {
      return 'Tentative: ' + ev.schedule.map((e) => `${dayByIso[e.iso].short} (${e.slot})`).join(', ');
    }
    if (ev.otherDate) return 'Other date: ' + ev.otherDate;
    return 'Not scheduled';
  }

  return {
    AUDIENCE_BUCKET_MAP,
    audienceBadge,
    audienceBuckets,
    buildEvent,
    buildSchedule,
    bucketsForDay,
    dayShortsFor,
    eventEndMin,
    eventTimeRangeLabel,
    eventTimeLabel,
    festivalBounds,
    formatClock,
    getScheduleEntry,
    hasTimedSchedule,
    headerIndex,
    headerRange,
    matchFestivalDate,
    norm,
    parseAnyDate,
    parseDurationToMin,
    parseLatLng,
    parseTimeToMin,
    pick,
    scheduleSummary,
    splitList,
    statusInfo,
    tentativeSlots,
  };
});
