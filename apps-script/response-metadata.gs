/**
 * SGF Google Forms response metadata.
 *
 * Install this as a script bound to the SGF response spreadsheet, then run
 * installResponseMetadata() once. It will:
 *   1. ensure the three metadata columns exist;
 *   2. backfill Entry ID, Form Response ID, and Edit Response URL; and
 *   3. install one form-submit trigger for future responses.
 *
 * Re-running installResponseMetadata() or backfillResponseMetadata() is safe.
 */

const SGF_RESPONSE_METADATA = Object.freeze({
  spreadsheetId: '1U8jFpmMSGMHrqNflQdCX3hxUbj0xtO4u9xYxRE7H8Pw',
  responseSheetName: 'Form Responses 1',
  timestampHeading: 'Timestamp',
  entryIdHeading: 'Entry ID',
  formResponseIdHeading: 'Form Response ID',
  editResponseUrlHeading: 'Edit Response URL',
  triggerHandler: 'handleFormSubmit',
});

/** One-time installer. Run manually from Apps Script. */
function installResponseMetadata() {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const context = getContext_();
    ensureMetadataColumns_(context.sheet);
    replaceFormSubmitTrigger_(context.form);
    return backfillResponseMetadataUnlocked_(context);
  } finally {
    lock.releaseLock();
  }
}

/** Safe to re-run whenever older rows need repairing. */
function backfillResponseMetadata() {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    return backfillResponseMetadataUnlocked_(getContext_());
  } finally {
    lock.releaseLock();
  }
}

/** Installable Google Form submit trigger handler. Do not run manually. */
function handleFormSubmit(event) {
  if (!event || !event.response) {
    throw new Error('handleFormSubmit must run from the installed Google Form submit trigger.');
  }

  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const context = getContext_();
    const columns = ensureMetadataColumns_(context.sheet);
    const response = event.response;

    // A form-bound trigger can fire just before the linked response row becomes
    // visible through SpreadsheetApp. Retry briefly instead of appending or
    // guessing a row.
    for (let attempt = 0; attempt < 8; attempt += 1) {
      const table = readResponseTable_(context.sheet);
      const rowNumber = findRowForResponse_(response, table, columns, new Set());
      if (rowNumber) {
        writeResponseMetadata_(context.sheet, rowNumber, columns, response);
        return {
          rowNumber,
          entryId: context.sheet.getRange(rowNumber, columns.entryId).getDisplayValue(),
          formResponseId: response.getId(),
        };
      }
      Utilities.sleep(1000);
    }

    throw new Error(
      `Could not find the response-sheet row for Form response ${response.getId()}. ` +
      'Run backfillResponseMetadata() to repair it.'
    );
  } finally {
    lock.releaseLock();
  }
}

function backfillResponseMetadataUnlocked_(context) {
  const columns = ensureMetadataColumns_(context.sheet);
  const table = readResponseTable_(context.sheet);
  const responses = context.form.getResponses();
  const assignedRows = new Set();
  const unresolvedResponseIds = [];
  let matchedResponses = 0;
  let createdEntryIds = 0;

  // Preserve any existing response-to-row assignments before matching blanks.
  for (let rowIndex = 1; rowIndex < table.values.length; rowIndex += 1) {
    const existingResponseId = clean_(table.values[rowIndex][columns.formResponseId - 1]);
    if (existingResponseId) assignedRows.add(rowIndex + 1);
  }

  for (const response of responses) {
    const rowNumber = findRowForResponse_(response, table, columns, assignedRows);
    if (!rowNumber) {
      unresolvedResponseIds.push(response.getId());
      continue;
    }

    const rowIndex = rowNumber - 1;
    if (!clean_(table.values[rowIndex][columns.entryId - 1])) {
      table.values[rowIndex][columns.entryId - 1] = Utilities.getUuid();
      createdEntryIds += 1;
    }
    table.values[rowIndex][columns.formResponseId - 1] = response.getId();
    table.values[rowIndex][columns.editResponseUrl - 1] = response.getEditResponseUrl();
    assignedRows.add(rowNumber);
    matchedResponses += 1;
  }

  // Every non-empty sheet entry gets an immutable Entry ID, even if an old
  // response cannot be matched automatically. The script never invents a Form
  // response ID or edit URL for an unresolved row.
  for (let rowIndex = 1; rowIndex < table.values.length; rowIndex += 1) {
    const timestamp = table.values[rowIndex][columns.timestamp - 1];
    if (!timestamp || clean_(table.values[rowIndex][columns.entryId - 1])) continue;
    table.values[rowIndex][columns.entryId - 1] = Utilities.getUuid();
    createdEntryIds += 1;
  }

  writeMetadataColumns_(context.sheet, table.values, columns);

  const unresolvedSheetRows = [];
  for (let rowIndex = 1; rowIndex < table.values.length; rowIndex += 1) {
    if (
      table.values[rowIndex][columns.timestamp - 1] &&
      !clean_(table.values[rowIndex][columns.formResponseId - 1])
    ) {
      unresolvedSheetRows.push(rowIndex + 1);
    }
  }

  const summary = {
    totalFormResponses: responses.length,
    matchedResponses,
    createdEntryIds,
    unresolvedResponseIds,
    unresolvedSheetRows,
  };
  console.log(JSON.stringify({
    responses: summary.responses,
    sheetRows: summary.sheetRows,
    entryIdsCreated: summary.entryIdsCreated,
    responseMetadataWritten: summary.responseMetadataWritten,
    unresolvedResponseIds: summary.unresolvedResponseIds.length,
    unresolvedSheetRows: summary.unresolvedSheetRows.length,
  }));
  return summary;
}

function getContext_() {
  const spreadsheet = SpreadsheetApp.openById(SGF_RESPONSE_METADATA.spreadsheetId);
  const sheet = spreadsheet.getSheetByName(SGF_RESPONSE_METADATA.responseSheetName);
  if (!sheet) {
    throw new Error(`Missing sheet: ${SGF_RESPONSE_METADATA.responseSheetName}`);
  }

  const formUrl = spreadsheet.getFormUrl();
  if (!formUrl) {
    throw new Error('The response spreadsheet is not linked to a Google Form.');
  }

  return {
    spreadsheet,
    sheet,
    form: FormApp.openByUrl(formUrl),
  };
}

function ensureMetadataColumns_(sheet) {
  const lastColumn = Math.max(sheet.getLastColumn(), 1);
  const headers = sheet.getRange(1, 1, 1, lastColumn).getDisplayValues()[0];
  const required = [
    SGF_RESPONSE_METADATA.entryIdHeading,
    SGF_RESPONSE_METADATA.formResponseIdHeading,
    SGF_RESPONSE_METADATA.editResponseUrlHeading,
  ];

  let nextColumn = lastNonEmptyColumn_(headers) + 1;
  for (const heading of required) {
    if (findHeaderColumn_(headers, heading)) continue;
    sheet.getRange(1, nextColumn).setValue(heading);
    headers[nextColumn - 1] = heading;
    nextColumn += 1;
  }

  const timestamp = findHeaderColumn_(headers, SGF_RESPONSE_METADATA.timestampHeading);
  const entryId = findHeaderColumn_(headers, SGF_RESPONSE_METADATA.entryIdHeading);
  const formResponseId = findHeaderColumn_(headers, SGF_RESPONSE_METADATA.formResponseIdHeading);
  const editResponseUrl = findHeaderColumn_(headers, SGF_RESPONSE_METADATA.editResponseUrlHeading);
  if (!timestamp || !entryId || !formResponseId || !editResponseUrl) {
    throw new Error('Could not resolve the response metadata headings.');
  }

  return { timestamp, entryId, formResponseId, editResponseUrl };
}

function replaceFormSubmitTrigger_(form) {
  for (const trigger of ScriptApp.getProjectTriggers()) {
    if (trigger.getHandlerFunction() === SGF_RESPONSE_METADATA.triggerHandler) {
      ScriptApp.deleteTrigger(trigger);
    }
  }

  ScriptApp.newTrigger(SGF_RESPONSE_METADATA.triggerHandler)
    .forForm(form)
    .onFormSubmit()
    .create();
}

function readResponseTable_(sheet) {
  const values = sheet.getDataRange().getValues();
  const headers = values[0] || [];
  const headerColumns = new Map();
  headers.forEach((heading, index) => {
    const key = clean_(heading);
    if (key) headerColumns.set(key, index + 1);
  });
  return { values, headerColumns };
}

function findRowForResponse_(response, table, columns, assignedRows) {
  const responseId = clean_(response.getId());

  // An existing ID is authoritative and makes retries idempotent.
  for (let rowIndex = 1; rowIndex < table.values.length; rowIndex += 1) {
    if (clean_(table.values[rowIndex][columns.formResponseId - 1]) === responseId) {
      return rowIndex + 1;
    }
  }

  const timestampKey = timestampKey_(response.getTimestamp());
  const candidates = [];
  for (let rowIndex = 1; rowIndex < table.values.length; rowIndex += 1) {
    const rowNumber = rowIndex + 1;
    if (assignedRows.has(rowNumber)) continue;
    const existingResponseId = clean_(table.values[rowIndex][columns.formResponseId - 1]);
    if (existingResponseId && existingResponseId !== responseId) continue;
    if (timestampKey_(table.values[rowIndex][columns.timestamp - 1]) === timestampKey) {
      candidates.push(rowNumber);
    }
  }

  if (candidates.length === 1) return candidates[0];
  if (!candidates.length) return null;

  // Timestamp collisions are resolved only by a unique highest count of exact
  // answers under exact matching question headings. Ties fail closed.
  const scored = candidates.map((rowNumber) => ({
    rowNumber,
    score: scoreResponseAgainstRow_(response, table, rowNumber),
  })).sort((a, b) => b.score - a.score);

  if (!scored[0].score || (scored[1] && scored[1].score === scored[0].score)) return null;
  return scored[0].rowNumber;
}

function scoreResponseAgainstRow_(response, table, rowNumber) {
  let score = 0;
  for (const itemResponse of response.getItemResponses()) {
    const heading = clean_(itemResponse.getItem().getTitle());
    const column = table.headerColumns.get(heading);
    if (!column) continue;
    const responseValue = comparable_(itemResponse.getResponse());
    const rowValue = comparable_(table.values[rowNumber - 1][column - 1]);
    if (responseValue && responseValue === rowValue) score += 1;
  }
  return score;
}

function writeResponseMetadata_(sheet, rowNumber, columns, response) {
  const entryCell = sheet.getRange(rowNumber, columns.entryId);
  if (!clean_(entryCell.getValue())) entryCell.setValue(Utilities.getUuid());
  sheet.getRange(rowNumber, columns.formResponseId).setValue(response.getId());
  sheet.getRange(rowNumber, columns.editResponseUrl).setValue(response.getEditResponseUrl());
}

function writeMetadataColumns_(sheet, values, columns) {
  if (values.length < 2) return;
  const rowCount = values.length - 1;
  const writeColumn = (column) => {
    const output = values.slice(1).map((row) => [row[column - 1] || '']);
    sheet.getRange(2, column, rowCount, 1).setValues(output);
  };
  writeColumn(columns.entryId);
  writeColumn(columns.formResponseId);
  writeColumn(columns.editResponseUrl);
}

function findHeaderColumn_(headers, heading) {
  const expected = clean_(heading);
  const index = headers.findIndex((header) => clean_(header) === expected);
  return index === -1 ? null : index + 1;
}

function lastNonEmptyColumn_(headers) {
  for (let index = headers.length - 1; index >= 0; index -= 1) {
    if (clean_(headers[index])) return index + 1;
  }
  return 0;
}

function timestampKey_(value) {
  const date = value instanceof Date ? value : new Date(value);
  const time = date.getTime();
  return Number.isFinite(time) ? String(Math.floor(time / 1000)) : '';
}

function comparable_(value) {
  if (Array.isArray(value)) return value.map(clean_).sort().join(',').toLowerCase();
  if (value instanceof Date) return timestampKey_(value);
  return clean_(value).replace(/\s+/g, ' ').toLowerCase();
}

function clean_(value) {
  return String(value == null ? '' : value).trim();
}
