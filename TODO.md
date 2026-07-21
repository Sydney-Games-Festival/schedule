# TODO

## Architecture

- [x] Extract shared domain helpers out of page controllers into reusable modules for scheduling, filters, and links.
- [x] Add lightweight automated tests for parsing, scheduling, visibility, and shared domain rules.
- [x] Add a shared validation/sanitization boundary for sheet-driven event data.

## Bug Fixes

- [x] P1: Fix specific-date matching so non-festival dates are not misclassified into 12-18 Oct 2026.
- [x] P2: Validate and normalize user-provided URLs before rendering them as links.
- [x] P2: Fix tentative multi-day labels so day-specific views only show that day's slot(s).
- [x] P2: Fix the admin "Unscheduled / TBD" filter so Before/After dated events stay out of that bucket.

## Future Consideration

- [ ] P3: Guard map re-renders against stale async geocoding responses.
- [ ] Consider moving venue geocoding out of the browser if traffic or reliability needs increase.
- [ ] Consider generating a normalized JSON artifact instead of parsing raw CSV on every page load.

## Admin Follow-up

- [x] Fix all-day admin schedule bucketing so long confirmed events appear in every overlapping time slot.
- [x] Fix admin day-view time parsing so sheet-exported times render across the correct whole-day span.
- [x] Fix admin list-view time formatting so confirmed events render readable day-local times instead of sheet epoch values.
- [x] Add a configurable admin-only live/sample data-source toggle that can be disabled to lock the page to the configured source.
- [x] Add a simple admin stats view with stage/type totals across festival days and overall total.
- [x] Improve the admin stats view styling so key summaries stand out and tables are easier to scan.
- [x] Refine the admin stats styling with corrected table alignment, clearer striping, and stronger KPI emphasis.
- [x] Split admin stats tentative/unscheduled events from events scheduled outside the festival-day window.
- [x] Add Screen (Digital) and Tabletop (Non-Digital) rollups to the admin game-type stats while keeping the detailed breakdown.
- [x] Add a tooltip to the admin Game Family stats table explaining the family mapping and uncategorised bucket.

## Code Review Findings (2026-07-21)

### Critical

- [ ] Fix DD/MM vs MM/DD date parsing. Google Sheets exports the "specific date"
  question as US `M/D/YYYY`, but `parseAnyDate` in `js/domain.js` reads slash
  dates day-first. Every festival-week specific date (`10/12`–`10/18`) misparses
  to a 2027 date, so a confirmed event that has a specific date but no
  planning-grid entry is thrown into the "After" region and disappears from its
  real day; events that also have a grid entry show as tentative instead of
  confirmed. Disambiguate by value (a number > 12 must be the day; otherwise
  default month-first to match the sheet's export locale) and build the date from
  explicit local components.

### Medium

- [ ] Add date-parsing tests using the real Google export formats
  (`10/17/2026`, `12/30/1899 9:00:00`). The existing suite only uses text dates
  ("Sat, Oct 17"), which hid the DD/MM bug; one test even encodes the wrong
  DD/MM assumption.
- [ ] Preserve paragraph breaks in long-text fields. `cleanText` collapses all
  whitespace including newlines, and description/blurb render in
  `white-space: pre-wrap` containers, so multi-paragraph text loses its breaks.
  Add a newline-preserving `cleanMultiline` and route description/blurb through it.
- [ ] Consolidate the duplicated URL normalization in `js/links.js` and
  `js/validation.js` into one source of truth. (deferred)

### Low

- [x] Stats "Total" row: per-column counts can exceed the total-column value
  because multi-day / multi-family events count in more than one bucket. This is
  by design — a 3-day event genuinely spans 3 day columns. Fixed by adding an
  explanatory tooltip to every stats table header (reusing the existing
  `statsTooltipHtml` mechanism). Placed at header level rather than on the Total
  column because `.stats-block` is `overflow: hidden` and `.stats-table-wrap` is
  `overflow-x: auto`, which would clip a tooltip rendered inside a `<th>`.
- [ ] Admin defaults to live data with no sample fallback, so an empty live sheet
  makes the admin look empty until "Sample" is selected. Intentional given real
  data is arriving; noted. (deferred)
- [ ] Persist the admin live/sample toggle selection across reloads. (deferred)
- [ ] P3: Guard admin/public map re-renders against stale async geocoding
  responses (already tracked under Future Consideration). (deferred)
