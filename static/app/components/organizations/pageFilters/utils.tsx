import {Location} from 'history';
import identity from 'lodash/identity';
import isEqual from 'lodash/isEqual';
import pick from 'lodash/pick';
import pickBy from 'lodash/pickBy';

import {DEFAULT_STATS_PERIOD} from 'sentry/constants';
import {DATE_TIME_KEYS, URL_PARAM} from 'sentry/constants/pageFilters';
import {Organization, PageFilters} from 'sentry/types';

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
 * Extract the page filter datetime parameters from an object.
 */
export function extractDatetimeSelectionParameters(query: Location['query']) {
  return pickBy(pick(query, Object.values(DATE_TIME_KEYS)), identity);
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

/**
 * TODO(davidenwang): Temporarily used for when pages with the GSH live alongside new page filters
 * @param organization
 * @returns list of paths that have the new page filters, these pages
 * should only load the pinned filters, not the whole global selection
 */
export function getPathsWithNewFilters(organization: Organization): string[] {
  return (
    organization.features.includes('selection-filters-v2')
      ? ['issues', 'user-feedback']
      : []
  ).map(route => `/organizations/${organization.slug}/${route}/`);
}
