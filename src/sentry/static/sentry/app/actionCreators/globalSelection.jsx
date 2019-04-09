/*eslint no-use-before-define: ["error", { "functions": false }]*/
import {isEqual, isInteger, omit} from 'lodash';
import * as Sentry from '@sentry/browser';

import {defined} from 'app/utils';
import {getUtcDateString} from 'app/utils/dates';
import GlobalSelectionActions from 'app/actions/globalSelectionActions';

const isEqualWithEmptyArrays = (newQuery, current) => {
  // We will only get empty arrays from `newQuery`
  // Can't use isEqualWith because keys are unbalanced (guessing)
  return isEqual(
    Object.entries(newQuery)
      .filter(([, value]) => !Array.isArray(value) || !!value.length)
      .reduce(
        (acc, [key, value]) => ({
          ...acc,
          [key]: value,
        }),
        {}
      ),
    current
  );
};

/**
 * Updates global project selection URL param if `router` is supplied
 * OTHERWISE fire action to update projects
 *
 * @param {Number[]} projects List of project ids
 * @param {Object} [router] Router object
 * @param {Object} [options] Options object
 * @param {String[]} [options.resetParams] List of parameters to remove when changing URL params
 */
export function updateProjects(projects, router, options) {
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

function isProjectsValid(projects) {
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
export function updateDateTime(datetime, router, options) {
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
export function updateEnvironments(environment, router, options) {
  if (!router) {
    GlobalSelectionActions.updateEnvironments(environment);
  }
  updateParams({environment}, router, options);
}

/**
 * Updates router/URL with new query params
 *
 * @param {Object} obj New query params
 * @param {Object} [router] React router object
 * @param {Object} [options] Options object
 * @param {String[]} [options.resetParams] List of parameters to remove when changing URL params
 */
export function updateParams(obj, router, options) {
  // Allow another component to handle routing
  if (!router) {
    return;
  }

  const newQuery = getNewQueryParams(obj, router.location.query, options);

  // Only push new location if query params has changed because this will cause a heavy re-render
  if (isEqualWithEmptyArrays(newQuery, router.location.query)) {
    return;
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
 * @param {Object} obj New query params
 * @param {Object} [router] React router object
 * @param {Object} [options] Options object
 * @param {String[]} [options.resetParams] List of parameters to remove when changing URL params
 */
export function updateParamsWithoutHistory(obj, router, options) {
  // Allow another component to handle routing
  if (!router) {
    return;
  }

  const newQuery = getNewQueryParams(obj, router.location.query, options);

  // Only push new location if query params have changed because this will cause a heavy re-render
  if (isEqualWithEmptyArrays(newQuery, router.location.query)) {
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
 * @param {Object} obj New query params
 * @param {Object} oldQueryParams Old query params
 * @param {Object} [options] Options object
 * @param {String[]} [options.resetParams] List of parameters to remove when changing URL params
 */
function getNewQueryParams(obj, oldQueryParams, {resetParams} = {}) {
  // Reset cursor when changing parameters
  // eslint-disable-next-line no-unused-vars
  const {cursor, statsPeriod, ...oldQuery} = oldQueryParams;
  const oldQueryWithoutResetParams =
    (resetParams && !!resetParams.length && omit(oldQuery, resetParams)) || oldQuery;

  const newQuery = getParams({
    ...oldQueryWithoutResetParams,
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

// Filters out params with null values and returns a default
// `statsPeriod` when necessary.
//
// Accepts `period` and `statsPeriod` but will only return `statsPeriod`
//
function getParams(params = {}) {
  const {start, end, period, statsPeriod, ...otherParams} = params;

  // `statsPeriod` takes precendence for now
  const coercedPeriod = statsPeriod || period;

  // Filter null values
  return Object.entries({
    statsPeriod: coercedPeriod,
    start: coercedPeriod ? null : start,
    end: coercedPeriod ? null : end,
    ...otherParams,
  })
    .filter(([key, value]) => defined(value))
    .reduce(
      (acc, [key, value]) => ({
        ...acc,
        [key]: value,
      }),
      {}
    );
}
