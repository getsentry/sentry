import * as Sentry from '@sentry/react';
import {Location} from 'history';
import identity from 'lodash/identity';
import isEqual from 'lodash/isEqual';
import pick from 'lodash/pick';
import pickBy from 'lodash/pickBy';

import {DATE_TIME_KEYS, URL_PARAM} from 'sentry/constants/pageFilters';
import OrganizationsStore from 'sentry/stores/organizationsStore';
import {Environment, PageFilters} from 'sentry/types';
import {defined} from 'sentry/utils';
import {getUtcToLocalDateObject} from 'sentry/utils/dates';
import localStorage from 'sentry/utils/localStorage';

import {getParams} from './getParams';

const DEFAULT_PARAMS = getParams({});

const LOCAL_STORAGE_KEY = 'global-selection';

// Parses URL query parameters for values relevant to page filters
type GetStateFromQueryOptions = {
  allowEmptyPeriod?: boolean;
  allowAbsoluteDatetime?: boolean;
};

export function getStateFromQuery(
  query: Location['query'],
  {allowEmptyPeriod = false, allowAbsoluteDatetime = true}: GetStateFromQueryOptions = {}
) {
  const parsedParams = getParams(query, {allowEmptyPeriod, allowAbsoluteDatetime});

  const projectFromQuery = query[URL_PARAM.PROJECT];
  const environmentFromQuery = query[URL_PARAM.ENVIRONMENT];
  const period = parsedParams.statsPeriod;
  const utc = parsedParams.utc;

  const hasAbsolute = allowAbsoluteDatetime && !!parsedParams.start && !!parsedParams.end;

  let project: number[] | null | undefined;
  if (defined(projectFromQuery) && Array.isArray(projectFromQuery)) {
    project = projectFromQuery.map(p => parseInt(p, 10));
  } else if (defined(projectFromQuery)) {
    const projectFromQueryIdInt = parseInt(projectFromQuery, 10);
    project = isNaN(projectFromQueryIdInt) ? [] : [projectFromQueryIdInt];
  } else {
    project = projectFromQuery;
  }

  const environment =
    defined(environmentFromQuery) && !Array.isArray(environmentFromQuery)
      ? [environmentFromQuery]
      : environmentFromQuery;

  const start = hasAbsolute ? getUtcToLocalDateObject(parsedParams.start) : null;
  const end = hasAbsolute ? getUtcToLocalDateObject(parsedParams.end) : null;

  return {
    project,
    environment,
    period: period || null,
    start: start || null,
    end: end || null,
    // params from URL will be a string
    utc: typeof utc !== 'undefined' ? utc === 'true' : null,
  };
}

/**
 * Extract the page filter parameters from an object
 * Useful for extracting page filter properties from the current URL
 * when building another URL.
 */
export function extractSelectionParameters(query) {
  return pickBy(pick(query, Object.values(URL_PARAM)), identity);
}

/**
 * Extract the page filter datetime parameters from an object.
 */
export function extractDatetimeSelectionParameters(query) {
  return pickBy(pick(query, Object.values(DATE_TIME_KEYS)), identity);
}

export function getDefaultSelection(): PageFilters {
  const utc = DEFAULT_PARAMS.utc;
  return {
    projects: [],
    environments: [],
    datetime: {
      start: DEFAULT_PARAMS.start || null,
      end: DEFAULT_PARAMS.end || null,
      period: DEFAULT_PARAMS.statsPeriod || '',
      utc: typeof utc !== 'undefined' ? utc === 'true' : null,
    },
  };
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

type ProjectId = string | number;
type EnvironmentId = Environment['id'];

type UpdateData = {
  project?: ProjectId[] | null;
  environment?: EnvironmentId[] | null;
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

  const {project, environment} = update;
  const validatedProject = project?.map(Number).filter(value => !isNaN(value));
  const validatedEnvironment = environment;

  const dataToSave = {
    projects: validatedProject || current.projects,
    environments: validatedEnvironment || current.environments,
  };

  const localStorageKey = `${LOCAL_STORAGE_KEY}:${org.slug}`;

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
  const localStorageKey = `${LOCAL_STORAGE_KEY}:${orgSlug}`;
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
  const localStorageKey = `${LOCAL_STORAGE_KEY}:${orgSlug}`;
  localStorage.removeItem(localStorageKey);
}
