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
