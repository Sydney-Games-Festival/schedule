/* SGF Schedule — shared configuration, loaded by every page (admin, public, map).
 * There is a single event data source for the whole site: the "Sanitised
 * Results" sheet tab, which already excludes the five contact columns (Name,
 * Email Address, Mobile number, Discord handle, Alternate Contact Method) at
 * the spreadsheet level — see REQUIREMENTS.md §9 for why. Admins who need an
 * organiser's contact details open the source Google Sheet directly (linked
 * from the admin event drawer) rather than the app fetching that data.
 * Flip USE_SAMPLE_DATA to false once real submissions exist in the sheet.
 * Even when false, a live tab that returns zero events auto-falls back to sample. */
window.SGF_CONFIG = {
  USE_SAMPLE_DATA: true,

  EVENTS_CSV_URL:
    'https://docs.google.com/spreadsheets/d/e/2PACX-1vQ_QICyyTV2CLhcoyQOO_v3HshLMA2MQBGU-dIjFxMLDImYkPN1pCvswFjGinOqqOHAVlLNyGblw6KN/pub?gid=171864363&single=true&output=csv',

  SAMPLE_CSV_URL: 'data/sample-events.csv',

  // Public page: "get notified of updates" link shown when a day has no events yet.
  NOTIFY_FORM_URL: 'https://forms.gle/BtvUKoyEaPAVCxLp7',

  // Festival week — Mon 12 Oct .. Sun 18 Oct 2026.
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
    { key: 'ideation',   label: 'Ideation',            match: 'ideation' },
    { key: 'early',      label: 'Early / Unconfirmed', match: 'early' },
    { key: 'confirmed',  label: 'Confirmed Planning',  match: 'confirmed' },
    { key: 'live',       label: 'Announced / Live',    match: 'announced' },
  ],
};
