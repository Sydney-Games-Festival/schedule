# SGF response metadata setup

`response-metadata.gs` backfills and maintains three columns on the protected
`Form Responses 1` tab:

- `Entry ID` — SGF-owned immutable UUID used to identify an event
- `Form Response ID` — Google Forms' submitted-response identifier
- `Edit Response URL` — bearer link that can edit that Form response

Only `Entry ID` should be selected into `Sanitised Results`. Never publish the
Form response ID or edit URL, and do not expose them through the current static
admin site because that page is not authenticated.

## One-time installation

1. Open the response spreadsheet.
2. Choose **Extensions → Apps Script**.
3. Paste `response-metadata.gs` into the bound project and save.
4. Select `installResponseMetadata` and click **Run**.
5. Review and approve the requested Google Forms and Google Sheets permissions.
6. Check the execution result. Both `unresolvedResponseIds` and
   `unresolvedSheetRows` should be empty.

The installer is idempotent: it preserves existing Entry IDs, repairs the
response IDs/edit URLs, removes only duplicate `handleFormSubmit` triggers, and
creates one fresh Form submit trigger.

## Future submissions

The installed Form submit trigger calls `handleFormSubmit`. It waits briefly for
the linked response-sheet row, then writes the Entry ID, Form response ID, and
edit URL under their exact headings. If it cannot match safely, it fails without
writing guessed metadata; run `backfillResponseMetadata` to repair the row.
