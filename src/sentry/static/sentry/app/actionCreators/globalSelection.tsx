import * as ReactRouter from 'react-router';
import * as Sentry from '@sentry/browser';
import isInteger from 'lodash/isInteger';
import omit from 'lodash/omit';
import qs from 'query-string';

import {Environment} from 'app/types';
import {defined} from 'app/utils';
import {getUtcDateString} from 'app/utils/dates';
import GlobalSelectionActions from 'app/actions/globalSelectionActions';

/**
 * Note this is the internal project.id, NOT the slug, but it is the stringified version of it
 */
type ProjectId = string | number;
type EnvironmentId = Environment['id'];

type Options = {
  /**
   * List of parameters to remove when changing URL params
   */
  resetParams?: string[];
  save?: boolean;
};

/**
 * Can be relative time string or absolute (using start and end dates)
 */
type DateTimeObject = {
  start?: Date | string | null;
  end?: Date | string | null;
  statsPeriod?: string | null;
  utc?: string | boolean | null;
  /**
   * @deprecated
   */
  period?: string | null;
};

// Get Params type from `getParams` helper
// type Params = Parameters<typeof getParams>[0];

/**
 * Cast project ids to strings, as everything is assumed to be a string in URL params
 *
 * Discover v1 uses a different interface, and passes slightly different datatypes e.g. Date for dates
 */
type UrlParams = {
  project?: ProjectId[] | null;
  environment?: EnvironmentId[] | null;
} & DateTimeObject & {
    // TODO(discoverv1): This can be back to `ParamValue` when we remove Discover
    [others: string]: any;
  };

/**
 * This can be null which will not perform any router side effects, and instead updates store.
 */
type Router = ReactRouter.InjectedRouter | null | undefined;

// Reset values in global selection store
export function resetGlobalSelection() {
  GlobalSelectionActions.reset();
}

/**
 * Updates global project selection URL param if `router` is supplied
 * OTHERWISE fire action to update projects
 */
export function updateProjects(
  projects: ProjectId[],
  router?: Router,
  options?: Options
) {
  if (!isProjectsValid(projects)) {
    Sentry.withScope(scope => {
      scope.setExtra('projects', projects);
      Sentry.captureException(new Error('Invalid projects selected'));
    });
    return;
  }

  if (!router) {
    GlobalSelectionActions.updateProjects(projects);
  }
  updateParams({project: projects}, router, options);
}

function isProjectsValid(projects: ProjectId[]) {
  return Array.isArray(projects) && projects.every(project => isInteger(project));
}

/**
 * Updates global datetime selection URL param if `router` is supplied
 * OTHERWISE fire action to update projects
 *
 * @param {Object} datetime Object with start, end, range keys
 * @param {Object} [router] Router object
 * @param {Object} [options] Options object
 * @param {String[]} [options.resetParams] List of parameters to remove when changing URL params
 */
export function updateDateTime(
  datetime: DateTimeObject,
  router?: Router,
  options?: Options
) {
  if (!router) {
    GlobalSelectionActions.updateDateTime(datetime);
  }
  updateParams(datetime, router, options);
}

/**
 * Updates global environment selection URL param if `router` is supplied
 * OTHERWISE fire action to update projects
 *
 * @param {String[]} environments List of environments
 * @param {Object} [router] Router object
 * @param {Object} [options] Options object
 * @param {String[]} [options.resetParams] List of parameters to remove when changing URL params
 */
export function updateEnvironments(
  environment: EnvironmentId[] | null,
  router?: Router,
  options?: Options
) {
  if (!router) {
    GlobalSelectionActions.updateEnvironments(environment);
  }
  updateParams({environment}, router, options);
}

/**
 * Updates router/URL with new query params
 *
 * @param obj New query params
 * @param [router] React router object
 * @param [options] Options object
 */
export function updateParams(obj: UrlParams, router?: Router, options?: Options) {
  // Allow another component to handle routing
  if (!router) {
    return;
  }

  const newQuery = getNewQueryParams(obj, router.location.query, options);

  // Only push new location if query params has changed because this will cause a heavy re-render
  if (qs.stringify(newQuery) === qs.stringify(router.location.query)) {
    return;
  }

  if (options?.save) {
    GlobalSelectionActions.save(newQuery);
  }

  router.push({
    pathname: router.location.pathname,
    query: newQuery,
  });
}

/**
 * Like updateParams but just replaces the current URL and does not create a
 * new browser history entry
 *
 * @param obj New query params
 * @param [router] React router object
 * @param [options] Options object
 */
export function updateParamsWithoutHistory(
  obj: UrlParams,
  router?: Router,
  options?: Options
) {
  // Allow another component to handle routing
  if (!router) {
    return;
  }

  const newQuery = getNewQueryParams(obj, router.location.query, options);

  // Only push new location if query params have changed because this will cause a heavy re-render
  if (qs.stringify(newQuery) === qs.stringify(router.location.query)) {
    return;
  }

  router.replace({
    pathname: router.location.pathname,
    query: newQuery,
  });
}

/**
 * Creates a new query parameter object given new params and old params
 * Preserves the old query params, except for `cursor`
 *
 * @param obj New query params
 * @param oldQueryParams Old query params
 * @param [options] Options object
 */
function getNewQueryParams(
  obj: UrlParams,
  oldQueryParams: UrlParams,
  {resetParams}: Options = {}
) {
  // Reset cursor when changing parameters
  const {cursor: _cursor, statsPeriod, ...oldQuery} = oldQueryParams;
  const oldQueryWithoutResetParams = !!resetParams?.length
    ? omit(oldQuery, resetParams)
    : oldQuery;

  const newQuery = getParams({
    ...oldQueryWithoutResetParams,
    // Some views update using `period`, and some `statsPeriod`, we should make this uniform
    period: !obj.start && !obj.end ? obj.period || statsPeriod : null,
    ...obj,
  });

  if (newQuery.start) {
    newQuery.start = getUtcDateString(newQuery.start);
  }

  if (newQuery.end) {
    newQuery.end = getUtcDateString(newQuery.end);
  }

  return newQuery;
}

function getParams(params: UrlParams): UrlParams {
  const {start, end, period, statsPeriod, ...otherParams} = params;

  // `statsPeriod` takes precendence for now
  const coercedPeriod = statsPeriod || period;

  // Filter null values
  return Object.fromEntries(
    Object.entries({
      statsPeriod: coercedPeriod,
      start: coercedPeriod ? null : start,
      end: coercedPeriod ? null : end,
      ...otherParams,
    }).filter(([, value]) => defined(value))
  );
}
