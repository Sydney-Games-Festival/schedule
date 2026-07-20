/* SGF Schedule — ADMIN-ONLY configuration extension.
 * Load this ONLY on admin.html and map.html, after config.js and before
 * data.js. Never add a <script> for this file to index.html (the public
 * page) — it embeds a link to the full submissions export, which includes
 * every organiser's Name, Email Address, Mobile number, Discord handle, and
 * Alternate Contact Method. */
Object.assign(window.SGF_CONFIG, {
  // Full "Form Responses 1" tab (has contact details) — used by the ADMIN
  // and MAP pages only.
  ADMIN_CSV_URL:
    'https://docs.google.com/spreadsheets/d/e/2PACX-1vQ_QICyyTV2CLhcoyQOO_v3HshLMA2MQBGU-dIjFxMLDImYkPN1pCvswFjGinOqqOHAVlLNyGblw6KN/pub?gid=1037089166&single=true&output=csv',
});
