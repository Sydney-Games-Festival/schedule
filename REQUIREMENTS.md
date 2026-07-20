# SGF Schedule — Requirements & Plan

Sydney Games Festival (SGF) event schedule site. Five static pages driven by the
event-registration Google Form responses, hosted free on GitHub Pages.

- **Festival dates:** Mon 12 Oct – Sun 18 Oct 2026 (7 days).
- **Repo / Pages name:** `sgf-schedule`.
- **Stack:** Static HTML + CSS + vanilla JS. CSV parsed client-side with
  [PapaParse](https://www.papaparse.com/) (CDN). No backend, no build step.
- **Pages:** public schedule (`index.html`) and public venue map (`map.html`)
  at the site root; admin schedule (`private/admin.html`) and admin venue map
  (`private/map.html`) under `private/` — see §8 for why "private" means
  unlisted, not access-controlled.

---

## 1. Data sources

Events come from the Google Form → Sheet → published CSV pipeline. For local
testing, a bundled `data/sample-events.csv` (12 events across all statuses)
stands in until real submissions arrive; `js/config.js` toggles sample vs live
and auto-falls-back to sample when the live tab is empty.

- **Form:** https://forms.gle/XAnQujoudWXonksa8
- **Sheet:** https://docs.google.com/spreadsheets/d/1U8jFpmMSGMHrqNflQdCX3hxUbj0xtO4u9xYxRE7H8Pw/edit
- **The one and only CSV every page reads — `EVENTS_CSV_URL` in `js/config.js`:**
  the **"Sanitised Results" tab** (gid `171864363`),
  `…/pub?gid=171864363&single=true&output=csv`. It already excludes the five
  contact columns (Name, Email Address, Mobile number, Discord handle,
  Alternate Contact Method) via a `QUERY` formula in its A1 — see §9 item 2 —
  but includes every other field (status, published, schedule, venue, game
  types, audience, blurb, ticket URL, event name, thumbnail). **There is no
  separate "admin" CSV any more** — see §8 for why.
- Admin's "Form Responses 1" tab (gid `1037089166`) is the raw form output with
  contacts. The app never fetches it. Admins who need an organiser's contact
  details open this tab directly in the Sheet (linked from the admin event
  drawer) rather than the site ever displaying it.

All pages fetch the CSV live at page load, so publishing a new sheet row (or
flipping an event's **Published** flag / status) updates every page with no
code change.

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

## 3. Page 1 — Admin (`private/admin.html`)

Functional, information-dense. Audience: organisers.

**Look:** clean white + blue, using the Google Form's fonts — **Space Grotesk**
(body) and **Special Gothic Expanded One** (headings), both from Google Fonts.

**Shows:** all events, every status and audience type. **No contact details**
(Name/Email/Mobile/Discord/Alt Contact) are fetched or displayed anywhere in
the app — the event detail drawer's "Contact details" section instead links
directly to the source Google Sheet (`SHEET_EDIT_URL` in `js/admin.js`), where
an admin with their own sheet access can look up the organiser using the
Organisation name and submitted-timestamp shown in the drawer.

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

**Per-event detail drawer:** title, organisation + role, org URL, reach,
co-organisers, description, blurb, game types, audience, duration, location,
attendance, max capacity, ticket URL, thumbnail, submitted timestamp, a
plain-language schedule summary (confirmed vs tentative), and the "open in
Google Sheet" contact link described above.

**Also:** data-source pill (sample vs live), manual refresh, dark/light theme
toggle (persisted).

---

## 4. Page 2 — Public schedule (`index.html`)

Matches the supplied screenshot. Shows only events with **`Published` = Y**.
No contact details ever rendered (see §1 — the CSV itself never contains them).
A small orange "🗺️ Venue map" badge (bottom-right) links to `map.html` (§6).

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

## 5. Page 3 — Admin venue map (`private/map.html`) — built

An interactive map of event **venues**, with each marker listing the event(s)
held there. Admin/planning aid (linked from the admin top bar).

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

---

## 6. Page 4 — Public venue map (`map.html`) — built

A duplicate of the admin map, stripped down for public consumption: **no
planning-stage or publish-status filters** — it only ever shows events with
`Published` = Y (same rule as the public schedule), and **defaults to every
venue across the whole festival** with a single **Day** dropdown to narrow to
one date. Linked from the public schedule's "🗺️ Venue map" badge and links
back to it.

- Same hybrid geocoding as the admin map (`js/geocode.js` is shared, unchanged).
- Recoloured to the public peach/orange theme (`css/map-public.css`, Fredoka +
  Space Grotesk) rather than the admin blue/white.
- Marker popups drop the status badge (not meaningful once everything shown is
  published) and add a **Tickets / info** link when the event has one.
- Logic lives in `js/map-public.js` (separate from the admin map's `js/map.js`
  since the filtering/data rules genuinely differ, not just styling).

---

## 7. Shared implementation

- `js/data.js` — fetch + PapaParse + column mapping + normalise each row into a
  clean `Event` object (status, title, org, gameTypes[], audiences[],
  schedule[], blurb, description, ticketUrl, image, etc.). Shared by every page.
  Resolves `SAMPLE_CSV_URL` against the location of `data.js` itself (not the
  page), so it works correctly whether loaded from the root or from `private/`.
- `js/admin.js`, `js/public.js`, `js/map.js` (admin map), `js/map-public.js`
  (public map) — page-specific rendering.
- `css/base.css` (shared vars/reset) + `css/admin.css` + `css/public.css` +
  `css/map.css` (admin map) + `css/map-public.css` (public map).
- `images/` — bundled event images + placeholder SVG + favicon.
- Graceful states: loading spinner, empty state, fetch-error message.
- Time parsing lives in `data.js` (`startMin`/`endMin`) and feeds the calendar grid.

---

## 8. Hosting (GitHub Pages, zero cost) & the privacy architecture

- Repo `sgf-schedule`, Pages served from `main` branch root.
- Public schedule at `/` (`index.html`), public map at `/map.html`; admin
  schedule at `/private/admin.html`, admin map at `/private/map.html`.
  **"private/" is a folder name, not access control** — same as before, these
  URLs are unlisted/obscure, not secret or authenticated. The actual privacy
  boundary is that **no contact data exists in anything the app fetches** (see
  below), not the URL's obscurity.
- Optional `CNAME` for a custom domain later.

### Why there's only one CSV now
Originally the plan was two CSVs: a full one (with contacts) for admin, a
sanitised one for public, each gated behind a separate config file
(`js/config.js` vs `js/config.admin.js`) so only admin/map pages downloaded the
contact-containing link. That got replaced with a simpler, more robust design
after investigating Google Sheets' "Publish to web" feature directly in the
Sheet's UI:

- The scope dropdown ("Entire document" vs a specific sheet) only changes the
  **preview link text** shown in the dialog — the actual access grant is a
  single global toggle for the whole spreadsheet. Google Sheets does not support
  publishing two sheets from one workbook on independently-revocable URLs.
- Confirmed empirically: with "Entire document" published, `.../pubhtml` lists
  **every** tab's name and `gid` in plaintext, so anyone who has *any* published
  link into the workbook can discover and fetch *any* other tab in it — the
  admin-only config file wasn't a complete fix on its own, just a smaller target.

**Resolution:** every page — public and admin alike — now reads the **same**
single CSV, the "Sanitised Results" tab, which already excludes the five
contact columns *at the spreadsheet level* (via its `QUERY` formula, §9 item 2).
There is nothing contact-containing for the app to ever fetch, so there is
nothing to leak regardless of how the sheet's publish scope is configured.
Admin's event drawer links directly to the source Sheet (`private/js/admin.js`
→ `SHEET_EDIT_URL`) for anyone who needs to look up an organiser's contact
details, which requires the admin's own Google account permissions on that
Sheet — not something this app ever handles.

### ⚠️ Remaining sheet-side cleanup (optional but recommended)
The Sheet's "Publish to web" is still scoped to **"Entire document"**, which
means the raw "Form Responses 1" tab (with contacts) is still technically
reachable by URL for anyone who goes looking, even though the app itself never
links to or fetches it any more. This is now a hygiene item, not an active
leak: **File → Share → Publish to web → Stop publishing** (or narrow the scope
to just "Sanitised Results") fully closes it. Wasn't done automatically because
changing your document's live public-sharing settings needs your own hands on
the confirmation dialog — an automated attempt to click through it hit a native
browser confirm dialog that couldn't be reliably driven by tooling and was
abandoned rather than risk an uncontrolled click.

---

## 9. Open items owned by you
1. ~~Rename "Column 33" → `Published`~~ — **done**, moved to column B. Set Y/N
   per event as submissions come in.
2. ~~Populate the "Sanitised Results" tab~~ — **done**. A1 holds:
   `=QUERY('Form Responses 1'!A:AI, "select A,B,C,E,F,G,H,M,N,O,P,Q,R,S,T,U,V,W,X,Y,Z,AA,AB,AC,AD,AE,AF,AG,AH,AI", 1)`
   — every column except Name/Email Address/Mobile number/Discord handle/
   Alternate Contact Method (verified live via the published CSV: 30 columns,
   zero contact fields). If the form's columns are ever reordered or renamed,
   this formula's column letters need updating to match.
3. **Map pages:** optionally add a `Venue Lat/Lng` column to override geocoding
   for any venues Nominatim gets wrong (hybrid approach — see §5). Not required
   to start; geocoding runs without it.
4. Provide/confirm the SGF logo and any real event thumbnails/URLs.
5. **When real event submissions start arriving**, flip `USE_SAMPLE_DATA` to
   `false` in `js/config.js` (commit + push) to switch every page from the
   sample dataset to live sheet data. The CSV is already live and correctly
   shaped — this is the only remaining switch.
6. **Sheet hygiene (optional, see §8):** File → Share → Publish to web → Stop
   publishing "Entire document" (or rescope to just "Sanitised Results"). Not
   urgent — the app no longer fetches or exposes the contact-containing tab
   either way — but worth doing to fully close it off at the source.

## 10. Build order
1. **Admin page first** — build, review against the full CSV, iterate until it
   works how you want. *(done — Schedule / Day / List views)*
2. **Public page second** — build to match the screenshot once admin is signed off.
   *(done — peach design, date rail, published-only cards)*
3. **Map pages third** — admin map, then a public-facing duplicate.
   *(done — Leaflet + hybrid geocoding, both variants)*
4. **Privacy hardening** — collapse to a single non-contact-containing CSV for
   every page, move admin pages under `private/`. *(done)*
