import * as Sentry from '@sentry/react';
import {Location} from 'history';
import identity from 'lodash/identity';
import isEqual from 'lodash/isEqual';
import pick from 'lodash/pick';
import pickBy from 'lodash/pickBy';

import {DEFAULT_STATS_PERIOD} from 'sentry/constants';
import {DATE_TIME_KEYS, URL_PARAM} from 'sentry/constants/pageFilters';
import OrganizationsStore from 'sentry/stores/organizationsStore';
import {PageFilters} from 'sentry/types';
import localStorage from 'sentry/utils/localStorage';

const LOCAL_STORAGE_KEY = 'global-selection';

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

function makeLocalStorageKey(orgSlug: string) {
  return `${LOCAL_STORAGE_KEY}:${orgSlug}`;
}

type UpdateData = {
  project?: string[] | null;
  environment?: string[] | null;
};

/**
 * Updates the localstorage page filters data
 *
 * e.g. if localstorage is empty, user loads issue details for project "foo"
 * this should not consider "foo" as last used and should not save to local
 * storage.
 *
 * However, if user then changes environment, it should...? Currently it will
 * save the current project alongside environment to local storage. It's
 * debatable if this is the desired behavior.
 *
 * This will be a no-op if a inaccessible organization slug is passed.
 */
export function setPageFiltersStorage(
  orgSlug: string | null,
  current: PageFilters,
  update: UpdateData
) {
  const org = orgSlug && OrganizationsStore.get(orgSlug);

  // Do nothing if no org is loaded or user is not an org member. Only
  // organizations that a user has membership in will be available via the
  // organizations store
  if (!org) {
    return;
  }

  const dataToSave = {
    projects: update.project || current.projects,
    environments: update.environment || current.environments,
  };

  const localStorageKey = makeLocalStorageKey(org.slug);

  try {
    localStorage.setItem(localStorageKey, JSON.stringify(dataToSave));
  } catch (ex) {
    // Do nothing
  }
}

/**
 * Retrives the page filters from local storage
 */
export function getPageFilterStorage(orgSlug: string) {
  const localStorageKey = makeLocalStorageKey(orgSlug);
  const value = localStorage.getItem(localStorageKey);

  if (!value) {
    return null;
  }

  try {
    return JSON.parse(value) as Omit<PageFilters, 'datetime'>;
  } catch (err) {
    // use default if invalid
    Sentry.captureException(err);
    console.error(err); // eslint-disable-line no-console
  }

  return null;
}

/**
 * Removes page filters from localstorage
 */
export function removePageFiltersStorage(orgSlug: string) {
  localStorage.removeItem(makeLocalStorageKey(orgSlug));
}
