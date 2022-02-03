import * as Sentry from '@sentry/react';

import PageFiltersStore from 'sentry/stores/pageFiltersStore';
import {PinnedPageFilter} from 'sentry/types';
import {getUtcDateString} from 'sentry/utils/dates';
import localStorage from 'sentry/utils/localStorage';

import {getStateFromQuery} from './parse';

function makeLocalStorageKey(orgSlug: string) {
  return `global-selection:${orgSlug}`;
}

type StoredObject = {
  projects: number[];
  environments: string[];
  start: string | null;
  end: string | null;
  period: string | null;
  utc: 'true' | null;
  pinnedFilters: PinnedPageFilter[];
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
 */
export function setPageFiltersStorage(orgSlug: string) {
  const {selection, pinnedFilters} = PageFiltersStore.getState();
  const {start: currentStart, end: currentEnd} = selection.datetime;

  const start = currentStart ? getUtcDateString(currentStart) : null;
  const end = currentEnd ? getUtcDateString(currentEnd) : null;
  const period = !start && !end ? selection.datetime.period : null;

  // XXX(epurkhiser): For legacy reasons the page filter state is stored
  // similarly to how the URL query state is stored, but with different keys
  // (projects, instead of project).
  const dataToSave: StoredObject = {
    projects: selection.projects,
    environments: selection.environments,
    start,
    end,
    period,
    utc: selection.datetime.utc ? 'true' : null,
    pinnedFilters: Array.from(pinnedFilters),
  };

  const localStorageKey = makeLocalStorageKey(orgSlug);

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

  let decoded: StoredObject;

  try {
    decoded = JSON.parse(value);
  } catch (err) {
    // use default if invalid
    Sentry.captureException(err);
    console.error(err); // eslint-disable-line no-console

    return null;
  }

  const {projects, environments, start, end, period, utc, pinnedFilters} = decoded;

  const state = getStateFromQuery(
    {
      project: projects.map(String),
      environment: environments,
      start,
      end,
      period,
      utc,
    },
    {allowAbsoluteDatetime: true}
  );

  return {state, pinnedFilters: new Set(pinnedFilters)};
}

/**
 * Removes page filters from localstorage
 */
export function removePageFiltersStorage(orgSlug: string) {
  localStorage.removeItem(makeLocalStorageKey(orgSlug));
}
