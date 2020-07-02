import * as ReactRouter from 'react-router';
import isInteger from 'lodash/isInteger';
import omit from 'lodash/omit';
import pick from 'lodash/pick';
import * as qs from 'query-string';
import * as Sentry from '@sentry/react';

import {
  DATE_TIME,
  LOCAL_STORAGE_KEY,
  URL_PARAM,
} from 'app/constants/globalSelectionHeader';
import {
  Environment,
  GlobalSelection,
  MinimalProject,
  Organization,
  Project,
} from 'app/types';
import {defined} from 'app/utils';
import {
  getDefaultSelection,
  getStateFromQuery,
} from 'app/components/organizations/globalSelectionHeader/utils';
import {getUtcDateString} from 'app/utils/dates';
import GlobalSelectionActions from 'app/actions/globalSelectionActions';
import localStorage from 'app/utils/localStorage';

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
  keepCursor?: boolean;
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

function getProjectIdFromProject(project: MinimalProject) {
  return parseInt(project.id, 10);
}

type InitializeUrlStateParams = {
  organization: Organization;
  queryParams: ReactRouter.WithRouterProps['location']['query'];
  router: ReactRouter.WithRouterProps['router'];
  memberProjects: Project[];
  shouldForceProject?: boolean;
  shouldEnforceSingleProject: boolean;
  /**
   * If true, do not load from local storage
   */
  skipLoadLastUsed?: boolean;
  defaultSelection?: Partial<GlobalSelection>;
  forceProject?: MinimalProject | null;
  showAbsolute?: boolean;
};

export function initializeUrlState({
  organization,
  queryParams,
  router,
  memberProjects,
  skipLoadLastUsed,
  shouldForceProject,
  shouldEnforceSingleProject,
  defaultSelection,
  forceProject,
  showAbsolute = true,
}: InitializeUrlStateParams) {
  const orgSlug = organization.slug;
  const query = pick(queryParams, [URL_PARAM.PROJECT, URL_PARAM.ENVIRONMENT]);
  const hasProjectOrEnvironmentInUrl = Object.keys(query).length > 0;
  const parsed = getStateFromQuery(queryParams, {
    allowAbsoluteDatetime: showAbsolute,
    allowEmptyPeriod: true,
  });
  const {datetime: defaultDateTime, ...retrievedDefaultSelection} = getDefaultSelection();
  const {datetime: customizedDefaultDateTime, ...customizedDefaultSelection} =
    defaultSelection || {};

  let globalSelection: Omit<GlobalSelection, 'datetime'> & {
    datetime: {
      [K in keyof GlobalSelection['datetime']]: GlobalSelection['datetime'][K] | null;
    };
  } = {
    ...retrievedDefaultSelection,
    ...customizedDefaultSelection,
    datetime: {
      [DATE_TIME.START as 'start']:
        parsed.start || customizedDefaultDateTime?.start || null,
      [DATE_TIME.END as 'end']: parsed.end || customizedDefaultDateTime?.end || null,
      [DATE_TIME.PERIOD as 'period']:
        parsed.period || customizedDefaultDateTime?.period || defaultDateTime.period,
      [DATE_TIME.UTC as 'utc']: parsed.utc || customizedDefaultDateTime?.utc || null,
    },
  };
  if (globalSelection.datetime.start && globalSelection.datetime.end) {
    globalSelection.datetime.period = null;
  }

  // We only save environment and project, so if those exist in
  // URL, do not touch local storage
  if (hasProjectOrEnvironmentInUrl) {
    globalSelection.projects = parsed.project || [];
    globalSelection.environments = parsed.environment || [];
  } else if (!skipLoadLastUsed) {
    try {
      const localStorageKey = `${LOCAL_STORAGE_KEY}:${orgSlug}`;
      const storedValue = localStorage.getItem(localStorageKey);

      if (storedValue) {
        globalSelection = {
          datetime: globalSelection.datetime,
          ...JSON.parse(storedValue),
        };
      }
    } catch (err) {
      // use default if invalid
      Sentry.captureException(err);
      console.error(err); // eslint-disable-line no-console
    }
  }

  const {projects, environments: environment, datetime} = globalSelection;
  let newProject: number[] | null = null;
  let project = projects;

  /**
   * Skip enforcing a single project if `shouldForceProject` is true,
   * since a component is controlling what that project needs to be.
   * This is true regardless if user has access to multi projects
   */
  if (shouldForceProject && forceProject) {
    newProject = [getProjectIdFromProject(forceProject)];
  } else if (shouldEnforceSingleProject && !shouldForceProject) {
    /**
     * If user does not have access to `global-views` (e.g. multi project select) *and* there is no
     * `project` URL parameter, then we update URL params with:
     * 1) the first project from the list of requested projects from URL params,
     * 2) first project user is a member of from org
     *
     * Note this is intentionally skipped if `shouldForceProject == true` since we want to initialize store
     * and wait for the forced project
     */
    if (projects && projects.length > 0) {
      // If there is a list of projects from URL params, select first project from that list
      newProject = typeof projects === 'string' ? [Number(projects)] : [projects[0]];
    } else {
      // When we have finished loading the organization into the props,  i.e. the organization slug is consistent with
      // the URL param--Sentry will get the first project from the organization that the user is a member of.
      newProject = [...memberProjects].slice(0, 1).map(getProjectIdFromProject);
    }
  }

  if (newProject) {
    globalSelection.projects = newProject;
    project = newProject;
  }

  GlobalSelectionActions.initializeUrlState(globalSelection);
  GlobalSelectionActions.setOrganization(organization);

  // To keep URLs clean, don't push default period if url params are empty
  const parsedWithNoDefaultPeriod = getStateFromQuery(queryParams, {
    allowEmptyPeriod: true,
    allowAbsoluteDatetime: showAbsolute,
  });

  const newDatetime = {
    ...datetime,
    period:
      !parsedWithNoDefaultPeriod.start &&
      !parsedWithNoDefaultPeriod.end &&
      !parsedWithNoDefaultPeriod.period
        ? null
        : datetime.period,
    utc: !parsedWithNoDefaultPeriod.utc ? null : datetime.utc,
  };
  updateParamsWithoutHistory({project, environment, ...newDatetime}, router, {
    keepCursor: true,
  });
}

/**
 * Updates store and global project selection URL param if `router` is supplied
 *
 * This accepts `environments` from `options` to also update environments simultaneously
 * as environments are tied to a project, so if you change projects, you may need
 * to clear environments.
 */
export function updateProjects(
  projects: ProjectId[],
  router?: Router,
  options?: Options & {environments?: EnvironmentId[]}
) {
  if (!isProjectsValid(projects)) {
    Sentry.withScope(scope => {
      scope.setExtra('projects', projects);
      Sentry.captureException(new Error('Invalid projects selected'));
    });
    return;
  }

  GlobalSelectionActions.updateProjects(projects, options?.environments);
  updateParams({project: projects, environment: options?.environments}, router, options);
}

function isProjectsValid(projects: ProjectId[]) {
  return Array.isArray(projects) && projects.every(project => isInteger(project));
}

/**
 * Updates store and global datetime selection URL param if `router` is supplied
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
  GlobalSelectionActions.updateDateTime(datetime);
  // We only save projects/environments to local storage, do not
  // save anything when date changes.
  updateParams(datetime, router, {...options, save: false});
}

/**
 * Updates store and updates global environment selection URL param if `router` is supplied
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
  GlobalSelectionActions.updateEnvironments(environment);
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
 * Preserves the old query params, except for `cursor` (can be overriden with keepCursor option)
 *
 * @param obj New query params
 * @param oldQueryParams Old query params
 * @param [options] Options object
 */
function getNewQueryParams(
  obj: UrlParams,
  oldQueryParams: UrlParams,
  {resetParams, keepCursor}: Options = {}
) {
  const {cursor, statsPeriod, ...oldQuery} = oldQueryParams;
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

  if (keepCursor) {
    newQuery.cursor = cursor;
  }

  return newQuery;
}

function getParams(params: UrlParams): UrlParams {
  const {start, end, period, statsPeriod, ...otherParams} = params;

  // `statsPeriod` takes precedence for now
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
