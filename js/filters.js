(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.SGF_FILTERS = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  function matchesPublishedFilter(ev, value) {
    if (value === 'y') return ev.published;
    if (value === 'n') return !ev.published;
    return true;
  }

  // Intentionally mirrors the current "unscheduled" behavior so the shared
  // filter layer can land before the bucket bug fix.
  function matchesDayFilter(ev, value) {
    if (!value) return true;
    if (value === 'unscheduled') return !ev.scheduled;
    return ev.dayIsos.includes(value);
  }

  function matchesStatusSet(ev, statuses) {
    return statuses.has(ev.status.key);
  }

  function matchesMembershipFilter(values, selected) {
    if (!selected) return true;
    return values.includes(selected);
  }

  function matchesTextSearch(parts, query) {
    if (!query) return true;
    const hay = parts.join(' ').toLowerCase();
    return hay.includes(query.toLowerCase());
  }

  function matchesAdminFilters(ev, filters) {
    return matchesStatusSet(ev, filters.statuses) &&
      matchesMembershipFilter(ev.audiences, filters.audience) &&
      matchesMembershipFilter(ev.gameTypes, filters.game) &&
      matchesPublishedFilter(ev, filters.pub) &&
      matchesDayFilter(ev, filters.day) &&
      matchesTextSearch([
        ev.title,
        ev.organisation,
        ev.organiser,
        ev.blurb,
        ev.description,
        ev.gameTypes.join(' '),
        ev.audiences.join(' '),
        ev.location,
      ], filters.search);
  }

  function matchesMapFilters(ev, filters) {
    return matchesStatusSet(ev, filters.statuses) &&
      matchesPublishedFilter(ev, filters.pub) &&
      matchesDayFilter(ev, filters.day);
  }

  return {
    matchesAdminFilters,
    matchesDayFilter,
    matchesMapFilters,
    matchesMembershipFilter,
    matchesPublishedFilter,
    matchesStatusSet,
    matchesTextSearch,
  };
});
