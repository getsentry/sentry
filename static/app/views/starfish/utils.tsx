import {Location} from 'history';

import {t} from 'sentry/locale';
import {NewQuery, Organization, PageFilters, Project} from 'sentry/types';
import {statsPeriodToDays} from 'sentry/utils/dates';
import EventView, {EventData} from 'sentry/utils/discover/eventView';
import getCurrentSentryReactTransaction from 'sentry/utils/getCurrentSentryReactTransaction';

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
