# SGF Schedule — Requirements & Plan

Sydney Games Festival (SGF) event schedule site. Two static pages driven by the
event-registration Google Form responses, hosted free on GitHub Pages.

- **Festival dates:** Mon 12 Oct – Sun 18 Oct 2026 (7 days).
- **Repo / Pages name:** `sgf-schedule`.
- **Stack:** Static HTML + CSS + vanilla JS. CSV parsed client-side with
  [PapaParse](https://www.papaparse.com/) (CDN). No backend, no build step.

---

## 1. Data sources

Events come from the Google Form → Sheet → published CSV pipeline. For local
testing, a bundled `data/sample-events.csv` (8 events across all statuses) stands
in until real submissions arrive; `js/config.js` toggles sample vs live and
auto-falls-back to sample when a live tab is empty.

- **Form:** https://forms.gle/XAnQujoudWXonksa8
- **Sheet:** https://docs.google.com/spreadsheets/d/1U8jFpmMSGMHrqNflQdCX3hxUbj0xtO4u9xYxRE7H8Pw/edit
- **Admin CSV (full, tab "Form Responses 1"):**
  `https://docs.google.com/spreadsheets/d/e/2PACX-1vQ_QICyyTV2CLhcoyQOO_v3HshLMA2MQBGU-dIjFxMLDImYkPN1pCvswFjGinOqqOHAVlLNyGblw6KN/pub?output=csv`
- **Public CSV (sanitised tab "Sanitised Results", gid `171864363`):**
  `…/pub?gid=171864363&single=true&output=csv`
  (whole document is published, so tabs are selected by `gid`). This tab is
  currently **empty** — it needs to be populated with a formula that mirrors the
  form responses minus contact columns (see §7). Until then the public page falls
  back to bundled sample data.
- Admin tab "Form Responses 1" has gid `1037089166`; the default `?output=csv`
  (no gid) also returns it.

Both pages fetch their CSV live at page load, so publishing a new sheet row (or
flipping an event's **Published** flag / status) updates the site with no code change.

### Publish gate (`Published` column)
- A **`Published`** column (Y/N) controls the public page: an event renders on
  `index.html` **only if `Published` = Y**. This is the single public gate
  (independent of Stage of Planning). In the live full tab this is the currently
  unnamed trailing column ("Column 33") — **rename it to `Published`**.
- The admin page ignores this gate and shows everything.

### Column matching is by header **name**, not position
The form will gain new fields (Event Name, Image). Code normalises header text
(lowercase, strip punctuation) and matches on keywords so added/reordered columns
don't break rendering.

### Current CSV columns (form order)
`Timestamp`, `Stage of Planning`, `Name`, `Organisation`, `Role`,
`Organisation URL`, `Estimate of people your organisation reaches?`,
`Email Address`, `Mobile number`, `Discord handle`, `Alternate Contact Method`,
`Who else is part of organising this event?`, `Tell us about your event`,
day/time grid ×8 (`… [Mon, Oct 12]` … `[Sun, Oct 18]`, `[Other date]`),
`How long will your event last? (duration)`, `Where do you plan to host the event?`,
`Estimated attendance size?`, `What is your max capacity?`,
`What type of games will be part of your event?`,
`What type of audience are you targeting?`, `Marketing Blurb (30 words)`,
`What is the specific date being planned?`, `What is the start time being planned?`,
`WIf known, what is the end time being planned?`,
`What URL should we direct people to? (more info, tickets)`.

### Form additions (done)
1. **Event Name** — form question added. Becomes the card title; falls back to
   Organisation if blank. (CSV column `Event Name`.)
2. **URL to Thumbnail** — form question added (a URL text field, not a file
   upload). The public page uses this URL directly as the card image; events with
   no thumbnail get a styled placeholder. (CSV column `URL to Thumbnail`.)

### Controlled vocabularies (from the form)
- **Stage of Planning:** Ideation · Early/Unconfirmed Planning · Confirmed
  Planning · **Announced / Live** (only this one shows publicly).
- **Audience:** General Public, Beginner Players, Beginner Makers, Experienced
  Players, Experienced Makers, Other Industry Players, Students, Academics (+Other).
  Multi-select → comma-joined in CSV.
- **Game types:** Board Games, Card Games / TCGs, Tabletop RPGs, Megagames, PC
  video games, Mobile games, Console video games, Arcade / Digital Game Cabinets,
  Serious Games, Puzzles / Escape Rooms, Miniatures / War Games,
  Game-Related / Pop Culture (+Other). Multi-select → comma-joined.
- **Day/time grid:** per day one or more of Morning / Afternoon / Evening.

---

## 2. Scheduling logic (which day an event lands on)

An event is placed on the festival calendar using this precedence:

1. If **specific date** is set and parses to a date within 12–18 Oct → place on
   that day, using specific start/end times.
2. Else, for each day column in the planning grid that has a value → place a
   *tentative* entry on that day, labelled with the Morning/Afternoon/Evening slot.
3. Else → "Unscheduled / TBD" bucket (admin page only).

`Other date` values are surfaced in the admin Unscheduled bucket with the raw text.

---

## 3. Page 1 — Admin (`admin.html`)

Functional, information-dense. Reads the **full** CSV. Audience: organisers.

**Look:** clean white + blue, using the Google Form's fonts — **Space Grotesk**
(body) and **Special Gothic Expanded One** (headings), both from Google Fonts.

**Shows:** all events, every status and audience type, including contact details
(admin uses the full CSV; contacts are kept out of the public sanitised tab).

**Three views** (chosen from the top bar; a sticky day-strip Mon 12 → Sun 18,
flush under the top bar, drives the single-day views):

- **Schedule** (default) — grouped by **Morning / Afternoon / Evening**. The
  day-strip selects the scope:
  - **All days** (default) — a **timetable matrix**: festival days run
    **horizontally as columns**, Morning/Afternoon/Evening are the **rows**, and
    each event sits in its day × slot cell. The slot-label column is frozen while
    the days scroll horizontally.
  - **A single day** — that day's Morning/Afternoon/Evening as vertical sections.
  - **A catch-all bucket** (Before / After / Other) — see below.
  Out-of-window buckets render beneath the matrix in All-days mode. Confirmed
  events bucket by start time (AM &lt;12pm, PM 12–5pm, EVE 5pm+); tentative events
  bucket by their Morning/Afternoon/Evening grid slot (and can appear in more than
  one slot).
- **Out-of-window catch-alls.** Events whose date falls outside Oct 12–18 are
  surfaced in three buckets, shown as their own day-strip tabs (only when
  non-empty) and as sections at the top/bottom of the All-days view:
  - **Before** — a real date parsed earlier than 12 Oct.
  - **After** — a real date parsed later than 18 Oct.
  - **Other / TBD** — a date that can't be parsed (free-text notes like
    "date still being decided").
  Each such card shows its resolved/entered date. Date parsing is best-effort
  (`Oct 25`, `25 Oct`, `25/10`, ISO, etc.), defaulting the year to the festival
  year. The calendar **Day** view remains single-festival-day only.
- **Day** — a single day laid out as a **time × venue grid** in half-hour
  increments. Columns are venues (`location`), blocks are positioned by
  start–end time (end derived from an explicit end time or the duration).
  Overlapping events at the *same* venue split into side-by-side lanes, so
  clashes are obvious; untimed/tentative events for that day are listed beneath.
- **List** — every event in a table; **all columns sortable** (click a header to
  sort, click again to reverse): Status, Pub, Event, Organiser, Day(s), Time,
  Audience, Games, Location.

**Filters (apply across all views):** free-text search, Stage of Planning
(colour-coded status toggles), audience type, game type, day, and Published Y/N.

**Per-event detail drawer:** title, organiser + role + org, all contacts
(email/mobile/Discord/alt), co-organisers, description, blurb, game types,
audience, duration, location, attendance, max capacity, ticket URL, thumbnail,
and a plain-language schedule summary (confirmed vs tentative).

**Also:** data-source pill (sample vs live), manual refresh, dark/light theme
toggle (persisted).

---

## 4. Page 2 — Public (`index.html`)

Matches the supplied screenshot. Reads the **sanitised** CSV and shows **only
`Announced / Live`** events. No contact details ever rendered.

**Design (from screenshot) — built.** Fonts: **Fredoka** (display) + **Space
Grotesk** (body).
- Warm peach gradient background, orange accent, rounded white cards, a single
  continuous orange top rule.
- **Left date rail:** vertical list of scopes — **all 7 festival days plus
  Before / After / Soon(Other) always shown**, even with zero events yet, so no
  date option ever silently disappears; active scope's day label (not the
  day-of-week sub-label) is underlined. Collapses to a horizontal scroll strip
  on mobile.
- **Empty day state:** a day with no published events shows a dashed card with
  "No events announced yet for this date — check back soon!" and a **Get
  notified of updates** button linking to the updates-signup form
  (`NOTIFY_FORM_URL` in `js/config.js`).
- **Day header:** big day label + right-aligned **outlined** hour range
  ("5 - 11 PM"), computed from that day's published events.
- **Event card:**
  - Time range (top-left) · audience badge "★ MAKERS/PLAYERS/…" derived from the
    most specific audience · **GET TICKETS** button → ticket URL (disabled style
    when no URL).
  - Uppercase orange title + organisation as subtitle.
  - Left: thumbnail (from `URL to Thumbnail`, falling back to a styled
    placeholder on missing/broken). Right: **About** = marketing blurb.
  - Footer chips: primary game type · location · duration.
  - Missing display fields render as "???", matching the screenshot.
- **Publish gate:** only events with `Published` = Y appear (§1).
- Responsive single-column card body on mobile.

---

## 5. Page 3 — Map (`map.html`) — built

An interactive map of event **venues**, with each marker listing the event(s)
held there. Admin/planning aid (linked from the admin top bar); reads the full
CSV so every status is visible.

- **Tech:** [Leaflet](https://leafletjs.com/) (via CDN) with OpenStreetMap tiles
  — free and GitHub-Pages friendly.
- **Markers:** one per distinct venue (grouped by the `location` text), sized/
  numbered by event count, coloured by status (blue if any event there is
  Announced/Live). Clicking a marker opens a popup listing every event at that
  venue (status badge, name, day(s), time).
- **Filtering:** status toggles, day, and published — same pattern as the admin
  page. Re-filtering is instant after the first load since geocoding results are
  cached.
- **Geocoding — hybrid, built as decided:**
  - **Manual override wins:** an optional `Venue Lat/Lng` sheet column
    (`"-33.8802, 151.1979"` format) — when present for a venue, used directly, no
    network call.
  - **Otherwise, client-side geocoding** via free OpenStreetMap **Nominatim**,
    throttled to 1 request/sec (its usage-policy limit) and cached in
    `localStorage` so each venue name is only ever looked up once, across visits.
  - A **"Locating venues… (n/total)"** progress indicator shows while the initial
    (uncached) geocoding pass runs.
- Venues that neither geocode nor have manual coordinates are listed in a side
  panel ("Unmapped venues") with their event counts, prompting a manual
  `Venue Lat/Lng` entry.
- **Verified on sample data:** 10 unique venues — 6 geocoded automatically, 1
  resolved via manual override (proving the override takes priority), 4 too vague
  to geocode ("TBC", "(tentative)", etc.) correctly land in Unmapped.

## 7. Shared implementation

- `js/data.js` — fetch + PapaParse + column mapping + normalise each row into a
  clean `Event` object (status, title, org, contacts, gameTypes[], audiences[],
  schedule[], blurb, description, ticketUrl, image, etc.). Shared by both pages.
- `js/admin.js`, `js/public.js`, `js/map.js` — page-specific rendering.
- `css/base.css` (shared vars/reset) + `css/admin.css` + `css/public.css` + `css/map.css`.
- `images/` — bundled event images + placeholder SVG + favicon.
- Graceful states: loading spinner, empty state, fetch-error message.
- Time parsing lives in `data.js` (`startMin`/`endMin`) and feeds the calendar grid.

---

## 8. Hosting (GitHub Pages, zero cost)

- Repo `sgf-schedule`, Pages served from `main` branch root.
- Public page at `/` (`index.html`); admin at `/admin.html` (unlisted URL — obscure,
  not secret; sensitive contacts are kept out of the public CSV via the sanitised
  tab, so even the admin page only exposes contacts to whoever has both the URL and
  the full CSV link).
- Optional `CNAME` for a custom domain later.

---

## 9. Open items owned by you
1. **Rename "Column 33" → `Published`** in the full tab and set Y/N per event.
2. **Populate the "Sanitised Results" tab** with a formula that mirrors the form
   responses **excluding** contact columns (Name, Email Address, Mobile number,
   Discord handle, Alternate Contact Method) but **including** `Stage of Planning`,
   the day/time grid, timing, game/audience types, `Marketing Blurb`, ticket URL,
   `Event Name`, `URL to Thumbnail`, and `Published`. A single spilled formula in
   the tab's A1 works, e.g. selecting the wanted columns from `'Form Responses 1'`.
   The public page reads gid `171864363`.
3. **Map page:** optionally add a `Venue Lat/Lng` column to override geocoding for
   any venues Nominatim gets wrong (hybrid approach — see §5). Not required to
   start; geocoding runs without it.
4. Provide/confirm the SGF logo and any real event thumbnails/URLs.

## 10. Build order
1. **Admin page first** — build, review against the full CSV, iterate until it
   works how you want. *(done — Day / Calendar / List views on sample data)*
2. **Public page second** — build to match the screenshot once admin is signed off.
   *(done — peach design, date rail, published-only cards on sample data)*
3. **Map page third** — *(done — Leaflet + hybrid geocoding, linked from admin)*
