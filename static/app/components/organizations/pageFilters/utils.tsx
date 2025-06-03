import type {Location} from 'history';
import identity from 'lodash/identity';
import isEqual from 'lodash/isEqual';
import pick from 'lodash/pick';
import pickBy from 'lodash/pickBy';

import {DEFAULT_STATS_PERIOD} from 'sentry/constants';
import {URL_PARAM} from 'sentry/constants/pageFilters';
import type {PageFilters} from 'sentry/types/core';

/**
 * Make a default page filters object
 */
export function getDefaultSelection(): PageFilters {
  const datetime = {
    start: null,
    end: null,
    period: DEFAULT_STATS_PERIOD,
    utc: null,
  };

  return {
    projects: [],
    environments: [],
    datetime,
  };
}

/**
 * Extract the page filter parameters from an object
 * Useful for extracting page filter properties from the current URL
 * when building another URL.
 */
export function extractSelectionParameters(query: Location['query']) {
  return pickBy(pick(query, Object.values(URL_PARAM)), identity);
}

/**
 * Compare the non-utc values of two selections.
 * Useful when re-fetching data based on page filters changing.
 *
 * utc is not compared as there is a problem somewhere in the selection
 * data flow that results in it being undefined | null | boolean instead of null | boolean.
 * The additional undefined state makes this function just as unreliable as isEqual(selection, other)
 */
export function isSelectionEqual(selection: PageFilters, other: PageFilters): boolean {
  if (
    !isEqual(selection.projects, other.projects) ||
    !isEqual(selection.environments, other.environments)
  ) {
    return false;
  }

  // Use string comparison as we aren't interested in the identity of the datetimes.
  if (
    selection.datetime.period !== other.datetime.period ||
    selection.datetime.start?.toString() !== other.datetime.start?.toString() ||
    selection.datetime.end?.toString() !== other.datetime.end?.toString()
  ) {
    return false;
  }

  return true;
}
