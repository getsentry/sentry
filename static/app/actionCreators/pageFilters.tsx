import {InjectedRouter} from 'react-router';
import * as Sentry from '@sentry/react';
import {Location} from 'history';
import isInteger from 'lodash/isInteger';
import omit from 'lodash/omit';
import pick from 'lodash/pick';
import * as qs from 'query-string';

import PageFiltersActions from 'sentry/actions/pageFiltersActions';
import {getStateFromQuery} from 'sentry/components/organizations/pageFilters/parse';
import {
  getDefaultSelection,
  getPageFilterStorage,
  setPageFiltersStorage,
} from 'sentry/components/organizations/pageFilters/utils';
import {DATE_TIME, URL_PARAM} from 'sentry/constants/pageFilters';
import PageFiltersStore from 'sentry/stores/pageFiltersStore';
import {
  DateString,
  Environment,
  MinimalProject,
  Organization,
  PageFilters,
  PinnedPageFilter,
  Project,
} from 'sentry/types';
import {defined} from 'sentry/utils';
import {getUtcDateString} from 'sentry/utils/dates';

/**
 * NOTE: this is the internal project.id, NOT the slug
 */
type ProjectId = string | number;
type EnvironmentId = Environment['id'];

type Options = {
  /**
   * List of parameters to remove when changing URL params
   */
  resetParams?: string[];
  /**
   * Do not reset the `cursor` query parameter when updating page filters
   */
  keepCursor?: boolean;
  /**
   * Persist changes to the page filter selection into local storage
   */
  save?: boolean;
  /**
   * Use Location.replace instead of push when updating the URL query state
   */
  replace?: boolean;
};

/**
 * Represents the datetime portion of page filters staate
 */
type DateTimeUpdate = {
  start?: DateString;
  end?: DateString;
  statsPeriod?: string | null;
  utc?: string | boolean | null;
  /**
   * @deprecated
   */
  period?: string | null;
};

/**
 * Object used to update the page filter parameters
 */
type UpdateParams = {
  project?: ProjectId[] | null;
  environment?: EnvironmentId[] | null;
} & DateTimeUpdate;

/**
 * Output object used for updating query parameters
 */
type PageFilterQuery = {
  project?: string[] | null;
  environment?: string[] | null;
  start?: string | null;
  end?: string | null;
  statsPeriod?: string | null;
  utc?: string | null;
  [extra: string]: Location['query'][string];
};

/**
 * This can be null which will not perform any router side effects, and instead updates store.
 */
type Router = InjectedRouter | null | undefined;

/**
 * Reset values in the page filters store
 */
export function resetPageFilters() {
  PageFiltersActions.reset();
}

function getProjectIdFromProject(project: MinimalProject) {
  return parseInt(project.id, 10);
}

type InitializeUrlStateParams = {
  organization: Organization;
  queryParams: Location['query'];
  router: InjectedRouter;
  memberProjects: Project[];
  shouldForceProject?: boolean;
  shouldEnforceSingleProject: boolean;
  /**
   * If true, do not load from local storage
   */
  skipLoadLastUsed?: boolean;
  defaultSelection?: Partial<PageFilters>;
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

  let pageFilters: Omit<PageFilters, 'datetime'> & {
    datetime: {
      [K in keyof PageFilters['datetime']]: PageFilters['datetime'][K] | null;
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

  if (pageFilters.datetime.start && pageFilters.datetime.end) {
    pageFilters.datetime.period = null;
  }

  if (hasProjectOrEnvironmentInUrl) {
    pageFilters.projects = parsed.project || [];
    pageFilters.environments = parsed.environment || [];
  }

  // We only save environment and project, so if those exist in URL, do not
  // touch local storage
  if (!hasProjectOrEnvironmentInUrl && !skipLoadLastUsed) {
    const storedPageFilters = getPageFilterStorage(orgSlug);

    if (storedPageFilters !== null) {
      pageFilters = {...storedPageFilters, datetime: pageFilters.datetime};
    }
  }

  const {projects, environments: environment, datetime} = pageFilters;
  let newProject: number[] | null = null;
  let project = projects;

  // Skip enforcing a single project if `shouldForceProject` is true, since a
  // component is controlling what that project needs to be. This is true
  // regardless if user has access to multi projects
  if (shouldForceProject && forceProject) {
    newProject = [getProjectIdFromProject(forceProject)];
  } else if (shouldEnforceSingleProject && !shouldForceProject) {
    // If user does not have access to `global-views` (e.g. multi project
    // select) *and* there is no `project` URL parameter, then we update URL
    // params with:
    //
    //  1) the first project from the list of requested projects from URL params
    //  2) first project user is a member of from org
    //
    // Note this is intentionally skipped if `shouldForceProject == true` since
    // we want to initialize store and wait for the forced project
    //
    if (projects && projects.length > 0) {
      // If there is a list of projects from URL params, select first project
      // from that list
      newProject = typeof projects === 'string' ? [Number(projects)] : [projects[0]];
    } else {
      // When we have finished loading the organization into the props,  i.e.
      // the organization slug is consistent with the URL param--Sentry will
      // get the first project from the organization that the user is a member
      // of.
      newProject = [...memberProjects].slice(0, 1).map(getProjectIdFromProject);
    }
  }

  if (newProject) {
    pageFilters.projects = newProject;
    project = newProject;
  }

  PageFiltersActions.initializeUrlState(pageFilters);
  PageFiltersActions.setOrganization(organization);

  const newDatetime = {
    ...datetime,
    period: !parsed.start && !parsed.end && !parsed.period ? null : datetime.period,
    utc: !parsed.utc ? null : datetime.utc,
  };

  updateParams({project, environment, ...newDatetime}, router, {
    replace: true,
    keepCursor: true,
  });
}

/**
 * Updates store and  selection URL param if `router` is supplied
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

  PageFiltersActions.updateProjects(projects, options?.environments);
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
  datetime: DateTimeUpdate,
  router?: Router,
  options?: Options
) {
  PageFiltersActions.updateDateTime(datetime);
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
  PageFiltersActions.updateEnvironments(environment);
  updateParams({environment}, router, options);
}

export function pinFilter(filter: PinnedPageFilter, pin: boolean) {
  PageFiltersActions.pin(filter, pin);

  // TODO: Persist into storage
}

/**
 * Updates router/URL with new query params
 *
 * @param obj New query params
 * @param [router] React router object
 * @param [options] Options object
 */
export function updateParams(obj: UpdateParams, router?: Router, options?: Options) {
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
    const {organization, selection} = PageFiltersStore.getState();
    const orgSlug = organization?.slug ?? null;

    setPageFiltersStorage(orgSlug, selection, newQuery);
  }

  const routerAction = options?.replace ? router.replace : router.push;

  routerAction({pathname: router.location.pathname, query: newQuery});
}

/**
 * Merges an UpdateParams object into a Location['query'] object. Results in a
 * PageFilterQuery
 *
 * Preserves the old query params, except for `cursor` (can be overriden with
 * keepCursor option)
 *
 * @param obj New query params
 * @param currentQuery The current query parameters
 * @param [options] Options object
 */
function getNewQueryParams(
  obj: UpdateParams,
  currentQuery: Location['query'],
  options: Options = {}
) {
  const {resetParams, keepCursor} = options;

  const cleanCurrentQuery = !!resetParams?.length
    ? omit(currentQuery, resetParams)
    : currentQuery;

  // Normalize existing query parameters
  const currentQueryState = getStateFromQuery(cleanCurrentQuery, {
    allowEmptyPeriod: true,
  });

  // Extract non page filter parameters.
  const cursorParam = !keepCursor ? 'cursor' : null;
  const omittedParameters = [...Object.values(URL_PARAM), cursorParam].filter(defined);

  const extraParams = omit(cleanCurrentQuery, omittedParameters);

  // Override parameters
  const {project, environment, start, end, utc} = {
    ...currentQueryState,
    ...obj,
  };

  // Only set a stats period if we don't have an absolute date
  //
  // `period` is deprecated as a url parameter, though some pages may still
  // include it (need to actually validate this?), normalize period and stats
  // period together
  const statsPeriod =
    !start && !end ? obj.statsPeriod || obj.period || currentQueryState.period : null;

  const newQuery: PageFilterQuery = {
    project: project?.map(String),
    environment,
    start: statsPeriod ? null : start instanceof Date ? getUtcDateString(start) : start,
    end: statsPeriod ? null : end instanceof Date ? getUtcDateString(end) : end,
    utc: utc ? 'true' : null,
    statsPeriod,
    ...extraParams,
  };

  const paramEntries = Object.entries(newQuery).filter(([_, value]) => defined(value));

  return Object.fromEntries(paramEntries) as PageFilterQuery;
}
