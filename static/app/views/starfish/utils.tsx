import {Location} from 'history';

import {ALL_ACCESS_PROJECTS} from 'sentry/constants/pageFilters';
import {backend, frontend, mobile} from 'sentry/data/platformCategories';
import {t} from 'sentry/locale';
import {NewQuery, Organization, PageFilters, Project, ReleaseProject} from 'sentry/types';
import {statsPeriodToDays} from 'sentry/utils/dates';
import EventView, {EventData} from 'sentry/utils/discover/eventView';
import getCurrentSentryReactTransaction from 'sentry/utils/getCurrentSentryReactTransaction';
import toArray from 'sentry/utils/toArray';

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
export enum PROJECT_PERFORMANCE_TYPE {
  ANY = 'any', // Fallback to transaction duration
  FRONTEND = 'frontend',
  BACKEND = 'backend',
  FRONTEND_OTHER = 'frontend_other',
  MOBILE = 'mobile',
}

// The native SDK is equally used on clients and end-devices as on
// backend, the default view should be "All Transactions".
const FRONTEND_PLATFORMS: string[] = [...frontend].filter(
  platform => platform !== 'javascript-nextjs' // Next has both frontend and backend transactions.
);
const BACKEND_PLATFORMS: string[] = backend.filter(platform => platform !== 'native');
const MOBILE_PLATFORMS: string[] = [...mobile];

export function platformToPerformanceType(
  projects: (Project | ReleaseProject)[],
  projectIds: readonly number[]
) {
  if (projectIds.length === 0 || projectIds[0] === ALL_ACCESS_PROJECTS) {
    return PROJECT_PERFORMANCE_TYPE.ANY;
  }

  const selectedProjects = projects.filter(p =>
    projectIds.includes(parseInt(`${p.id}`, 10))
  );

  if (selectedProjects.length === 0 || selectedProjects.some(p => !p.platform)) {
    return PROJECT_PERFORMANCE_TYPE.ANY;
  }

  const projectPerformanceTypes = new Set<PROJECT_PERFORMANCE_TYPE>();

  selectedProjects.forEach(project => {
    if (FRONTEND_PLATFORMS.includes(project.platform ?? '')) {
      projectPerformanceTypes.add(PROJECT_PERFORMANCE_TYPE.FRONTEND);
    }
    if (BACKEND_PLATFORMS.includes(project.platform ?? '')) {
      projectPerformanceTypes.add(PROJECT_PERFORMANCE_TYPE.BACKEND);
    }
    if (MOBILE_PLATFORMS.includes(project.platform ?? '')) {
      projectPerformanceTypes.add(PROJECT_PERFORMANCE_TYPE.MOBILE);
    }
  });

  const uniquePerformanceTypeCount = projectPerformanceTypes.size;

  if (!uniquePerformanceTypeCount || uniquePerformanceTypeCount > 1) {
    return PROJECT_PERFORMANCE_TYPE.ANY;
  }
  const [platformType] = projectPerformanceTypes;
  return platformType;
}

export function addRoutePerformanceContext(selection: PageFilters) {
  const transaction = getCurrentSentryReactTransaction();
  const days = statsPeriodToDays(
    selection.datetime.period,
    selection.datetime.start,
    selection.datetime.end
  );
  const oneDay = 86400;
  const seconds = Math.floor(days * oneDay);

  transaction?.setTag('query.period', seconds.toString());
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
  transaction?.setTag('query.period.grouped', groupedPeriod);
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

export function getProjectID(
  eventData: EventData,
  projects: Project[]
): string | undefined {
  const projectSlug = (eventData?.project as string) || undefined;

  if (typeof projectSlug === undefined) {
    return undefined;
  }

  return projects.find(currentProject => currentProject.slug === projectSlug)?.id;
}
