import * as Sentry from '@sentry/react';
import type {Location} from 'history';
import isInteger from 'lodash/isInteger';
import omit from 'lodash/omit';
import pick from 'lodash/pick';
import * as qs from 'query-string';

import {
  getDatetimeFromState,
  getStateFromQuery,
} from 'sentry/components/organizations/pageFilters/parse';
import {
  getPageFilterStorage,
  setPageFiltersStorage,
} from 'sentry/components/organizations/pageFilters/persistence';
import type {PageFiltersStringified} from 'sentry/components/organizations/pageFilters/types';
import {getDefaultSelection} from 'sentry/components/organizations/pageFilters/utils';
import {parseStatsPeriod} from 'sentry/components/timeRangeSelector/utils';
import {
  ALL_ACCESS_PROJECTS,
  DATE_TIME_KEYS,
  URL_PARAM,
} from 'sentry/constants/pageFilters';
import OrganizationStore from 'sentry/stores/organizationStore';
import PageFiltersStore from 'sentry/stores/pageFiltersStore';
import type {DateString, PageFilters, PinnedPageFilter} from 'sentry/types/core';
import type {InjectedRouter} from 'sentry/types/legacyReactRouter';
import type {Organization} from 'sentry/types/organization';
import type {Environment, MinimalProject, Project} from 'sentry/types/project';
import {defined} from 'sentry/utils';
import {getUtcDateString} from 'sentry/utils/dates';
import {DAY} from 'sentry/utils/formatters';
import {valueIsEqual} from 'sentry/utils/object/valueIsEqual';

type EnvironmentId = Environment['id'];

type Options = {
  /**
   * Do not reset the `cursor` query parameter when updating page filters
   */
  keepCursor?: boolean;
  /**
   * Use Location.replace instead of push when updating the URL query state
   */
  replace?: boolean;
  /**
   * List of parameters to remove when changing URL params
   */
  resetParams?: string[];
  /**
   * Persist changes to the page filter selection into local storage
   */
  save?: boolean;
  /**
   * Optional prefix for the storage key, for areas of the app that need separate pagefilters (i.e Starfish)
   */
  storageNamespace?: string;
};

/**
 * This is the 'update' object used for updating the page filters. The types
 * here are a bit wider to allow for easy updates.
 */
type PageFiltersUpdate = {
  end?: DateString;
  environment?: string[] | null;
  period?: string | null;
  project?: number[] | null;
  start?: DateString;
  utc?: boolean | null;
};

/**
 * Represents the input for updating the date time of page filters
 */
type DateTimeUpdate = Pick<PageFiltersUpdate, 'start' | 'end' | 'period' | 'utc'>;

/**
 * Output object used for updating query parameters
 */
type PageFilterQuery = PageFiltersStringified & Record<string, Location['query'][string]>;

/**
 * This can be null which will not perform any router side effects, and instead updates store.
 */
type Router = InjectedRouter | null | undefined;

/**
 * Reset values in the page filters store
 */
export function resetPageFilters() {
  PageFiltersStore.onReset();
}

function getProjectIdFromProject(project: MinimalProject) {
  return parseInt(project.id, 10);
}

/**
 * Merges two date time objects, where the `base` object takes precedence, and
 * the `fallback` values are used when the base values are null or undefined.
 */
function mergeDatetime(
  base: PageFilters['datetime'],
  fallback?: Partial<PageFilters['datetime']>
) {
  const datetime: PageFilters['datetime'] = {
    start: base.start ?? fallback?.start ?? null,
    end: base.end ?? fallback?.end ?? null,
    period: base.period ?? fallback?.period ?? null,
    utc: base.utc ?? fallback?.utc ?? null,
  };

  return datetime;
}

export type InitializeUrlStateParams = {
  memberProjects: Project[];
  nonMemberProjects: Project[];
  organization: Organization;
  queryParams: Location['query'];
  router: InjectedRouter;
  shouldEnforceSingleProject: boolean;
  defaultSelection?: Partial<PageFilters>;
  forceProject?: MinimalProject | null;
  /**
   * When set, the stats period will fallback to the `maxPickableDays` days if the stored selection exceeds the limit.
   */
  maxPickableDays?: number;
  shouldForceProject?: boolean;
  /**
   * Whether to save changes to local storage. This setting should be page-specific:
   * most pages should have it on (default) and some, like Dashboard Details, need it
   * off.
   */
  shouldPersist?: boolean;
  showAbsolute?: boolean;
  /**
   * When used with shouldForceProject it will not persist the project id
   * to url query parameters on load. This is useful when global selection header
   * is used for display purposes rather than selection.
   */
  skipInitializeUrlParams?: boolean;

  /**
   * Skip loading from local storage
   * An example is Issue Details, in the case where it is accessed directly (e.g. from email).
   * We do not want to load the user's last used env/project in this case, otherwise will
   * lead to very confusing behavior.
   */
  skipLoadLastUsed?: boolean;

  /**
   * Skip loading last used environment from local storage
   * An example is Starfish, which doesn't support environments.
   */
  skipLoadLastUsedEnvironment?: boolean;
  /**
   * Optional prefix for the storage key, for areas of the app that need separate pagefilters (i.e Starfish)
   */
  storageNamespace?: string;
};

export function initializeUrlState({
  organization,
  queryParams,
  router,
  memberProjects,
  nonMemberProjects,
  skipLoadLastUsed,
  skipLoadLastUsedEnvironment,
  maxPickableDays,
  shouldPersist = true,
  shouldForceProject,
  shouldEnforceSingleProject,
  defaultSelection,
  forceProject,
  showAbsolute = true,
  skipInitializeUrlParams = false,
  storageNamespace,
}: InitializeUrlStateParams) {
  const orgSlug = organization.slug;

  const parsed = getStateFromQuery(queryParams, {
    allowAbsoluteDatetime: showAbsolute,
    allowEmptyPeriod: true,
  });

  const {datetime: defaultDatetime, ...defaultFilters} = getDefaultSelection();
  const {datetime: customDatetime, ...customDefaultFilters} = defaultSelection ?? {};

  const pageFilters: PageFilters = {
    ...defaultFilters,
    ...customDefaultFilters,
    datetime: mergeDatetime(parsed, customDatetime),
  };

  // Use period from default if we don't have a period set
  pageFilters.datetime.period ??= defaultDatetime.period;

  // Do not set a period if we have absolute start and end
  if (pageFilters.datetime.start && pageFilters.datetime.end) {
    pageFilters.datetime.period = null;
  }

  const hasDatetimeInUrl = Object.keys(pick(queryParams, DATE_TIME_KEYS)).length > 0;
  const hasProjectOrEnvironmentInUrl =
    Object.keys(pick(queryParams, [URL_PARAM.PROJECT, URL_PARAM.ENVIRONMENT])).length > 0;

  // We should only check and update the desync state if the site has just been loaded
  // (not counting route changes). To check this, we can use the `isReady` state: if it's
  // false, then the site was just loaded. Once it's true, `isReady` stays true
  // through route changes.
  let shouldCheckDesyncedURLState = !PageFiltersStore.getState().isReady;

  /**
   * Check to make sure that the project ID exists in the projects list. Invalid project
   * IDs (project was deleted/moved to another org) can still exist in local storage or
   * shared links.
   */
  function validateProjectId(projectId: number): boolean {
    if (projectId === ALL_ACCESS_PROJECTS) {
      return !shouldEnforceSingleProject;
    }

    return (
      !!memberProjects?.some(mp => String(mp.id) === String(projectId)) ||
      !!nonMemberProjects?.some(nmp => String(nmp.id) === String(projectId))
    );
  }

  /**
   * Check to make sure that the environment exists. Invalid environments (due to being
   * hidden) can still exist in local storage or shared links.
   */
  function validateEnvironment(env: string): boolean {
    return (
      !!memberProjects?.some(mp => mp.environments.includes(env)) ||
      !!nonMemberProjects?.some(nmp => nmp.environments.includes(env))
    );
  }

  if (hasProjectOrEnvironmentInUrl) {
    pageFilters.projects = parsed.project?.filter(validateProjectId) || [];
    pageFilters.environments = parsed.environment?.filter(validateEnvironment) || [];

    if (
      pageFilters.projects.length < (parsed.project?.length ?? 0) ||
      pageFilters.environments.length < (parsed.environment?.length ?? 0)
    ) {
      // don't check desync state since we're going to remove invalid projects/envs from
      // the URL query
      shouldCheckDesyncedURLState = false;
    }
  }

  const storedPageFilters = skipLoadLastUsed
    ? null
    : getPageFilterStorage(orgSlug, storageNamespace);
  let shouldUsePinnedDatetime = false;
  let shouldUpdateLocalStorage = false;

  // We may want to restore some page filters from local storage. In the new
  // world when they are pinned, and in the old world as long as
  // skipLoadLastUsed is not set to true.
  if (storedPageFilters) {
    const {state: storedState, pinnedFilters} = storedPageFilters;

    if (!hasProjectOrEnvironmentInUrl && pinnedFilters.has('projects')) {
      pageFilters.projects = storedState.project?.filter(validateProjectId) ?? [];

      if (pageFilters.projects.length < (storedState.project?.length ?? 0)) {
        shouldUpdateLocalStorage = true; // update storage to remove invalid projects
        shouldCheckDesyncedURLState = false;
      }
    }

    if (
      !skipLoadLastUsedEnvironment &&
      !hasProjectOrEnvironmentInUrl &&
      pinnedFilters.has('environments')
    ) {
      pageFilters.environments =
        storedState.environment?.filter(validateEnvironment) ?? [];

      if (pageFilters.environments.length < (storedState.environment?.length ?? 0)) {
        shouldUpdateLocalStorage = true; // update storage to remove invalid environments
        shouldCheckDesyncedURLState = false;
      }
    }

    if (!hasDatetimeInUrl && pinnedFilters.has('datetime')) {
      pageFilters.datetime = getDatetimeFromState(storedState);
      shouldUsePinnedDatetime = true;
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
      newProject = typeof projects === 'string' ? [Number(projects)] : [projects[0]!];
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

  let shouldUseMaxPickableDays = false;

  if (maxPickableDays && pageFilters.datetime) {
    let {start, end} = pageFilters.datetime;

    if (pageFilters.datetime.period) {
      const parsedPeriod = parseStatsPeriod(pageFilters.datetime.period);
      start = parsedPeriod.start;
      end = parsedPeriod.end;
    }

    if (start && end) {
      const difference = new Date(end).getTime() - new Date(start).getTime();
      if (difference > maxPickableDays * DAY) {
        shouldUseMaxPickableDays = true;
        pageFilters.datetime = {
          period: `${maxPickableDays}d`,
          start: null,
          end: null,
          utc: datetime.utc,
        };
      }
    }
  }

  const pinnedFilters = organization.features.includes('new-page-filter')
    ? new Set<PinnedPageFilter>(['projects', 'environments', 'datetime'])
    : storedPageFilters?.pinnedFilters ?? new Set();

  PageFiltersStore.onInitializeUrlState(pageFilters, pinnedFilters, shouldPersist);
  if (shouldUpdateLocalStorage) {
    setPageFiltersStorage(organization.slug, new Set(['projects', 'environments']));
  }

  if (shouldCheckDesyncedURLState) {
    checkDesyncedUrlState(router, shouldForceProject);
  } else {
    // Clear desync state on route changes
    PageFiltersStore.updateDesyncedFilters(new Set());
  }

  const newDatetime = shouldUseMaxPickableDays
    ? {
        period: `${maxPickableDays}d`,
        start: null,
        end: null,
        utc: datetime.utc,
      }
    : {
        ...datetime,
        period:
          parsed.start || parsed.end || parsed.period || shouldUsePinnedDatetime
            ? datetime.period
            : null,
        utc: parsed.utc || shouldUsePinnedDatetime ? datetime.utc : null,
      };

  if (!skipInitializeUrlParams) {
    updateParams({project, environment, ...newDatetime}, router, {
      replace: true,
      keepCursor: true,
    });
  }
}

function isProjectsValid(projects: number[]) {
  return Array.isArray(projects) && projects.every(isInteger);
}

/**
 * Updates store and selection URL param if `router` is supplied
 *
 * This accepts `environments` from `options` to also update environments
 * simultaneously as environments are tied to a project, so if you change
 * projects, you may need to clear environments.
 */
export function updateProjects(
  projects: number[],
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

  PageFiltersStore.updateProjects(projects, options?.environments ?? null);
  updateParams({project: projects, environment: options?.environments}, router, options);
  persistPageFilters('projects', options);

  if (options?.environments) {
    persistPageFilters('environments', options);
  }
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
  PageFiltersStore.updateEnvironments(environment);
  updateParams({environment}, router, options);
  persistPageFilters('environments', options);
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
  const {selection} = PageFiltersStore.getState();
  PageFiltersStore.updateDateTime({...selection.datetime, ...datetime});
  updateParams(datetime, router, options);
  persistPageFilters('datetime', options);
}

/**
 * Pins a particular filter so that it is read out of local storage
 */
export function pinFilter(filter: PinnedPageFilter, pin: boolean) {
  PageFiltersStore.pin(filter, pin);
  persistPageFilters(null, {save: true});
}

/**
 * Changes whether any value updates will be persisted into local storage.
 */
export function updatePersistence(shouldPersist: boolean) {
  PageFiltersStore.updatePersistence(shouldPersist);
}

/**
 * Updates router/URL with new query params
 *
 * @param obj New query params
 * @param [router] React router object
 * @param [options] Options object
 */
function updateParams(obj: PageFiltersUpdate, router?: Router, options?: Options) {
  // Allow another component to handle routing
  if (!router) {
    return;
  }

  const newQuery = getNewQueryParams(obj, router.location.query, options);

  // Only push new location if query params has changed because this will cause a heavy re-render
  if (qs.stringify(newQuery) === qs.stringify(router.location.query)) {
    return;
  }

  const routerAction = options?.replace ? router.replace : router.push;

  routerAction({pathname: router.location.pathname, query: newQuery});
}

/**
 * Save a specific page filter to local storage.
 *
 * Pinned state is always persisted.
 */
async function persistPageFilters(filter: PinnedPageFilter | null, options?: Options) {
  if (!options?.save || !PageFiltersStore.getState().shouldPersist) {
    return;
  }

  // XXX(epurkhiser): Since this is called immediately after updating the
  // store, wait for a tick since stores are not updated fully synchronously.
  // A bit goofy, but it works fine.
  await new Promise(resolve => window.setTimeout(resolve, 0));

  const {organization} = OrganizationStore.getState();
  const orgSlug = organization?.slug ?? null;

  // Can't do anything if we don't have an organization
  if (orgSlug === null) {
    return;
  }

  const targetFilter = filter !== null ? [filter] : [];
  setPageFiltersStorage(
    orgSlug,
    new Set<PinnedPageFilter>(targetFilter),
    options.storageNamespace
  );
}

/**
 * Checks if the URL state has changed in synchronization from the local
 * storage state, and persists that check into the store.
 *
 * If shouldForceProject is enabled, then we do not record any url desync
 * for the project.
 */
async function checkDesyncedUrlState(router?: Router, shouldForceProject?: boolean) {
  // Cannot compare URL state without the router
  if (!router || !PageFiltersStore.getState().shouldPersist) {
    return;
  }

  const {query} = router.location;

  // XXX(epurkhiser): Since this is called immediately after updating the
  // store, wait for a tick since stores are not updated fully synchronously.
  // This function *should* be called only after persistPageFilters has been
  // called as well This function *should* be called only after
  // persistPageFilters has been called as well
  await new Promise(resolve => window.setTimeout(resolve, 0));

  const {organization} = OrganizationStore.getState();

  // Can't do anything if we don't have an organization
  if (organization === null) {
    return;
  }

  const storedPageFilters = getPageFilterStorage(organization.slug);

  // If we don't have any stored page filters then we do not check desynced state
  if (!storedPageFilters) {
    PageFiltersStore.updateDesyncedFilters(new Set<PinnedPageFilter>());
    return;
  }

  const currentQuery = getStateFromQuery(query, {
    allowAbsoluteDatetime: true,
    allowEmptyPeriod: true,
  });

  const differingFilters = new Set<PinnedPageFilter>();
  const {pinnedFilters, state: storedState} = storedPageFilters;

  // Are selected projects different?
  if (
    pinnedFilters.has('projects') &&
    currentQuery.project !== null &&
    !valueIsEqual(currentQuery.project, storedState.project) &&
    !shouldForceProject
  ) {
    differingFilters.add('projects');
  }

  // Are selected environments different?
  if (
    pinnedFilters.has('environments') &&
    currentQuery.environment !== null &&
    !valueIsEqual(currentQuery.environment, storedState.environment)
  ) {
    differingFilters.add('environments');
  }

  const dateTimeInQuery =
    currentQuery.end !== null ||
    currentQuery.start !== null ||
    currentQuery.utc !== null ||
    currentQuery.period !== null;

  // Is the datetime filter different?
  if (
    pinnedFilters.has('datetime') &&
    dateTimeInQuery &&
    (currentQuery.period !== storedState.period ||
      currentQuery.start?.getTime() !== storedState.start?.getTime() ||
      currentQuery.end?.getTime() !== storedState.end?.getTime() ||
      currentQuery.utc !== storedState.utc)
  ) {
    differingFilters.add('datetime');
  }

  PageFiltersStore.updateDesyncedFilters(differingFilters);
}

/**
 * Commits the new desynced filter values and clears the desynced filters list.
 */
export function saveDesyncedFilters() {
  const {desyncedFilters} = PageFiltersStore.getState();
  [...desyncedFilters].forEach(filter => persistPageFilters(filter, {save: true}));
  PageFiltersStore.updateDesyncedFilters(new Set());
}

/**
 * Merges an UpdateParams object into a Location['query'] object. Results in a
 * PageFilterQuery
 *
 * Preserves the old query params, except for `cursor` (can be overridden with
 * keepCursor option)
 *
 * @param obj New query params
 * @param currentQuery The current query parameters
 * @param [options] Options object
 */
function getNewQueryParams(
  obj: PageFiltersUpdate,
  currentQuery: Location['query'],
  options: Options = {}
) {
  const {resetParams, keepCursor} = options;

  const cleanCurrentQuery = resetParams?.length
    ? omit(currentQuery, resetParams)
    : currentQuery;

  // Normalize existing query parameters
  const currentQueryState = getStateFromQuery(cleanCurrentQuery, {
    allowEmptyPeriod: true,
    allowAbsoluteDatetime: true,
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
  const statsPeriod = !start && !end ? obj.period || currentQueryState.period : null;

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

export function revertToPinnedFilters(orgSlug: string, router: InjectedRouter) {
  const {selection, desyncedFilters} = PageFiltersStore.getState();
  const storedFilterState = getPageFilterStorage(orgSlug)?.state;

  if (!storedFilterState) {
    return;
  }

  const newParams = {
    project: desyncedFilters.has('projects')
      ? storedFilterState.project
      : selection.projects,
    environment: desyncedFilters.has('environments')
      ? storedFilterState.environment
      : selection.environments,
    ...(desyncedFilters.has('datetime')
      ? pick(storedFilterState, DATE_TIME_KEYS)
      : selection.datetime),
  };

  updateParams(newParams, router, {
    keepCursor: true,
  });
  PageFiltersStore.updateDesyncedFilters(new Set());
}
