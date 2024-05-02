import type {Location} from 'history';

import {ALL_ACCESS_PROJECTS} from 'sentry/constants/pageFilters';
import {backend, frontend, mobile} from 'sentry/data/platformCategories';
import {t} from 'sentry/locale';
import type {
  NewQuery,
  Organization,
  OrganizationSummary,
  PageFilters,
  Project,
  ReleaseProject,
} from 'sentry/types';
import {trackAnalytics} from 'sentry/utils/analytics';
import toArray from 'sentry/utils/array/toArray';
import {browserHistory} from 'sentry/utils/browserHistory';
import {statsPeriodToDays} from 'sentry/utils/dates';
import type {EventData} from 'sentry/utils/discover/eventView';
import EventView from 'sentry/utils/discover/eventView';
import {TRACING_FIELDS} from 'sentry/utils/discover/fields';
import getCurrentSentryReactRootSpan from 'sentry/utils/getCurrentSentryReactRootSpan';
import {useQuery} from 'sentry/utils/queryClient';
import {decodeScalar} from 'sentry/utils/queryString';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import useApi from 'sentry/utils/useApi';
import useOrganization from 'sentry/utils/useOrganization';
import useProjects from 'sentry/utils/useProjects';
import {normalizeUrl} from 'sentry/utils/withDomainRequired';

import {DEFAULT_MAX_DURATION} from '../trends/utils';

export const QUERY_KEYS = [
  'environment',
  'project',
  'query',
  'start',
  'end',
  'statsPeriod',
] as const;

export const UNPARAMETERIZED_TRANSACTION = '<< unparameterized >>'; // Represents 'other' transactions with high cardinality names that were dropped on the metrics dataset.
const UNPARAMETRIZED_TRANSACTION = '<< unparametrized >>'; // Old spelling. Can be deleted in the future when all data for this transaction name is gone.
export const EXCLUDE_METRICS_UNPARAM_CONDITIONS = `(!transaction:"${UNPARAMETERIZED_TRANSACTION}" AND !transaction:"${UNPARAMETRIZED_TRANSACTION}")`;
const SHOW_UNPARAM_BANNER = 'showUnparameterizedBanner';

export enum DiscoverQueryPageSource {
  PERFORMANCE = 'performance',
  DISCOVER = 'discover',
}

export function createUnnamedTransactionsDiscoverTarget(props: {
  location: Location;
  organization: Organization;
  source?: DiscoverQueryPageSource;
}) {
  const fields =
    props.source === DiscoverQueryPageSource.DISCOVER
      ? ['transaction', 'project', 'transaction.source', 'epm()']
      : ['transaction', 'project', 'transaction.source', 'epm()', 'p50()', 'p95()'];

  const query: NewQuery = {
    id: undefined,
    name:
      props.source === DiscoverQueryPageSource.DISCOVER
        ? t('Unparameterized Transactions')
        : t('Performance - Unparameterized Transactions'),
    query: 'event.type:transaction transaction.source:"url"',
    projects: [],
    fields,
    version: 2,
  };

  const discoverEventView = EventView.fromNewQueryWithLocation(
    query,
    props.location
  ).withSorts([{field: 'epm', kind: 'desc'}]);
  const target = discoverEventView.getResultsViewUrlTarget(props.organization.slug);
  target.query[SHOW_UNPARAM_BANNER] = 'true';
  return target;
}

/**
 * Performance type can used to determine a default view or which specific field should be used by default on pages
 * where we don't want to wait for transaction data to return to determine how to display aspects of a page.
 */
export enum ProjectPerformanceType {
  ANY = 'any', // Fallback to transaction duration
  FRONTEND = 'frontend',
  BACKEND = 'backend',
  FRONTEND_OTHER = 'frontend_other',
  MOBILE = 'mobile',
}

// The native SDK is equally used on clients and end-devices as on
// backend, the default view should be "All Transactions".
const FRONTEND_PLATFORMS: string[] = frontend.filter(
  platform =>
    // Next, Remix and Sveltekit have both, frontend and backend transactions.
    !['javascript-nextjs', 'javascript-remix', 'javascript-sveltekit'].includes(platform)
);
const BACKEND_PLATFORMS: string[] = backend.filter(
  platform => platform !== 'native' && platform !== 'nintendo-switch'
);
const MOBILE_PLATFORMS: string[] = [...mobile];

export function platformToPerformanceType(
  projects: (Project | ReleaseProject)[],
  projectIds: readonly number[]
) {
  if (projectIds.length === 0 || projectIds[0] === ALL_ACCESS_PROJECTS) {
    return ProjectPerformanceType.ANY;
  }

  const selectedProjects = projects.filter(p =>
    projectIds.includes(parseInt(`${p.id}`, 10))
  );

  if (selectedProjects.length === 0 || selectedProjects.some(p => !p.platform)) {
    return ProjectPerformanceType.ANY;
  }

  const projectPerformanceTypes = new Set<ProjectPerformanceType>();

  selectedProjects.forEach(project => {
    if (FRONTEND_PLATFORMS.includes(project.platform ?? '')) {
      projectPerformanceTypes.add(ProjectPerformanceType.FRONTEND);
    }
    if (BACKEND_PLATFORMS.includes(project.platform ?? '')) {
      projectPerformanceTypes.add(ProjectPerformanceType.BACKEND);
    }
    if (MOBILE_PLATFORMS.includes(project.platform ?? '')) {
      projectPerformanceTypes.add(ProjectPerformanceType.MOBILE);
    }
  });

  const uniquePerformanceTypeCount = projectPerformanceTypes.size;

  if (!uniquePerformanceTypeCount || uniquePerformanceTypeCount > 1) {
    return ProjectPerformanceType.ANY;
  }
  const [PlatformKey] = projectPerformanceTypes;
  return PlatformKey;
}

/**
 * Used for transaction summary to determine appropriate columns on a page, since there is no display field set for the page.
 */
export function platformAndConditionsToPerformanceType(
  projects: Project[],
  eventView: EventView
) {
  const performanceType = platformToPerformanceType(projects, eventView.project);
  if (performanceType === ProjectPerformanceType.FRONTEND) {
    const conditions = new MutableSearch(eventView.query);
    const ops = conditions.getFilterValues('!transaction.op');
    if (ops.some(op => op === 'pageload')) {
      return ProjectPerformanceType.FRONTEND_OTHER;
    }
  }

  return performanceType;
}

/**
 * Used for transaction summary to check the view itself, since it can have conditions which would exclude it from having vitals aside from platform.
 */
export function isSummaryViewFrontendPageLoad(eventView: EventView, projects: Project[]) {
  return (
    platformAndConditionsToPerformanceType(projects, eventView) ===
    ProjectPerformanceType.FRONTEND
  );
}

export function isSummaryViewFrontend(eventView: EventView, projects: Project[]) {
  return (
    platformAndConditionsToPerformanceType(projects, eventView) ===
      ProjectPerformanceType.FRONTEND ||
    platformAndConditionsToPerformanceType(projects, eventView) ===
      ProjectPerformanceType.FRONTEND_OTHER
  );
}

export function getPerformanceLandingUrl(organization: OrganizationSummary): string {
  return `/organizations/${organization.slug}/performance/`;
}

export function getPerformanceTrendsUrl(organization: OrganizationSummary): string {
  return `/organizations/${organization.slug}/performance/trends/`;
}

export function getTransactionSearchQuery(location: Location, query: string = '') {
  return decodeScalar(location.query.query, query).trim();
}

export function handleTrendsClick({
  location,
  organization,
  projectPlatforms,
}: {
  location: Location;
  organization: Organization;
  projectPlatforms: string;
}) {
  trackAnalytics('performance_views.change_view', {
    organization,
    view_name: 'TRENDS',
    project_platforms: projectPlatforms,
  });

  const target = trendsTargetRoute({location, organization});

  browserHistory.push(normalizeUrl(target));
}

export function trendsTargetRoute({
  location,
  organization,
  initialConditions,
  additionalQuery,
}: {
  location: Location;
  organization: Organization;
  additionalQuery?: {[x: string]: string};
  initialConditions?: MutableSearch;
}) {
  const newQuery = {
    ...location.query,
    ...additionalQuery,
  };

  const query = decodeScalar(location.query.query, '');
  const conditions = new MutableSearch(query);

  const modifiedConditions = initialConditions ?? new MutableSearch([]);

  // Trends on metrics don't need these conditions
  if (!organization.features.includes('performance-new-trends')) {
    // No need to carry over tpm filters to transaction summary
    if (conditions.hasFilter('tpm()')) {
      modifiedConditions.setFilterValues('tpm()', conditions.getFilterValues('tpm()'));
    } else {
      modifiedConditions.setFilterValues('tpm()', ['>0.01']);
    }

    if (conditions.hasFilter('transaction.duration')) {
      modifiedConditions.setFilterValues(
        'transaction.duration',
        conditions.getFilterValues('transaction.duration')
      );
    } else {
      modifiedConditions.setFilterValues('transaction.duration', [
        '>0',
        `<${DEFAULT_MAX_DURATION}`,
      ]);
    }
  }
  newQuery.query = modifiedConditions.formatString();

  return {pathname: getPerformanceTrendsUrl(organization), query: {...newQuery}};
}

export function removeTracingKeysFromSearch(
  currentFilter: MutableSearch,
  options: {excludeTagKeys: Set<string>} = {
    excludeTagKeys: new Set([
      // event type can be "transaction" but we're searching for issues
      'event.type',
      // the project is already determined by the transaction,
      // and issue search does not support the project filter
      'project',
    ]),
  }
) {
  currentFilter.getFilterKeys().forEach(tagKey => {
    const searchKey = tagKey.startsWith('!') ? tagKey.substring(1) : tagKey;
    // Remove aggregates and transaction event fields
    if (
      // aggregates
      searchKey.match(/\w+\(.*\)/) ||
      // transaction event fields
      TRACING_FIELDS.includes(searchKey) ||
      // tags that we don't want to pass to pass to issue search
      options.excludeTagKeys.has(searchKey)
    ) {
      currentFilter.removeFilter(tagKey);
    }
  });

  return currentFilter;
}

export function addRoutePerformanceContext(selection: PageFilters) {
  const transaction = getCurrentSentryReactRootSpan();
  const days = statsPeriodToDays(
    selection.datetime.period,
    selection.datetime.start,
    selection.datetime.end
  );
  const oneDay = 86400;
  const seconds = Math.floor(days * oneDay);

  transaction?.setAttribute('query.period', seconds.toString());
  let groupedPeriod = '>30d';
  if (seconds <= oneDay) {
    groupedPeriod = '<=1d';
  } else if (seconds <= oneDay * 7) {
    groupedPeriod = '<=7d';
  } else if (seconds <= oneDay * 14) {
    groupedPeriod = '<=14d';
  } else if (seconds <= oneDay * 30) {
    groupedPeriod = '<=30d';
  }
  transaction?.setAttribute('query.period.grouped', groupedPeriod);
}

export function getTransactionName(location: Location): string | undefined {
  const {transaction} = location.query;

  return decodeScalar(transaction);
}

export function getIsMultiProject(projects: readonly number[] | number[]) {
  if (!projects.length) {
    return true; // My projects
  }
  if (projects.length === 1 && projects[0] === ALL_ACCESS_PROJECTS) {
    return true; // All projects
  }
  return false;
}

export function getSelectedProjectPlatformsArray(
  location: Location,
  projects: Project[]
) {
  const projectQuery = location.query.project;
  const selectedProjectIdSet = new Set(toArray(projectQuery));

  const selectedProjectPlatforms = projects.reduce((acc: string[], project) => {
    if (selectedProjectIdSet.has(project.id)) {
      acc.push(project.platform ?? 'undefined');
    }

    return acc;
  }, []);

  return selectedProjectPlatforms;
}

export function getSelectedProjectPlatforms(location: Location, projects: Project[]) {
  const selectedProjectPlatforms = getSelectedProjectPlatformsArray(location, projects);
  return selectedProjectPlatforms.join(', ');
}

export function getProject(
  eventData: EventData,
  projects: Project[]
): Project | undefined {
  const projectSlug = (eventData?.project as string) || undefined;

  if (typeof projectSlug === undefined) {
    return undefined;
  }

  return projects.find(currentProject => currentProject.slug === projectSlug);
}

export function getProjectID(
  eventData: EventData,
  projects: Project[]
): string | undefined {
  return getProject(eventData, projects)?.id;
}

export function usePerformanceGeneralProjectSettings(projectId?: number) {
  const api = useApi();
  const organization = useOrganization();
  const {projects} = useProjects();
  const stringProjectId = projectId?.toString();
  const project = projects.find(p => p.id === stringProjectId);

  return useQuery(['settings', 'general', projectId], {
    enabled: Boolean(project),
    queryFn: () =>
      api.requestPromise(
        `/api/0/projects/${organization.slug}/${project?.slug}/performance/configure/`
      ) as Promise<{enable_images: boolean}>,
  });
}
