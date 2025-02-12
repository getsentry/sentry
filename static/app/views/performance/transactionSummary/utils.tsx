import styled from '@emotion/styled';
import type {Location, LocationDescriptor, Query} from 'history';

import {space} from 'sentry/styles/space';
import type {PlainRoute} from 'sentry/types/legacyReactRouter';
import type {Organization} from 'sentry/types/organization';
import {getDateFromTimestamp} from 'sentry/utils/dates';
import type {TableDataRow} from 'sentry/utils/discover/discoverQuery';
import {generateLinkToEventInTraceView} from 'sentry/utils/discover/urls';
import getRouteStringFromRoutes from 'sentry/utils/getRouteStringFromRoutes';
import {
  generateContinuousProfileFlamechartRouteWithQuery,
  generateProfileFlamechartRoute,
} from 'sentry/utils/profiling/routes';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import normalizeUrl from 'sentry/utils/url/normalizeUrl';
import {DOMAIN_VIEW_BASE_URL} from 'sentry/views/insights/pages/settings';
import type {DomainView} from 'sentry/views/insights/pages/useFilters';
import {getTraceDetailsUrl} from 'sentry/views/performance/traceDetails/utils';
import {getPerformanceBaseUrl} from 'sentry/views/performance/utils';
import {makeReplaysPathname} from 'sentry/views/replays/pathnames';

import {TraceViewSources} from '../newTraceDetails/traceHeader/breadcrumbs';

export enum DisplayModes {
  DURATION_PERCENTILE = 'durationpercentile',
  DURATION = 'duration',
  LATENCY = 'latency',
  TREND = 'trend',
  VITALS = 'vitals',
  USER_MISERY = 'usermisery',
}

export enum TransactionFilterOptions {
  FASTEST = 'fastest',
  SLOW = 'slow',
  OUTLIER = 'outlier',
  RECENT = 'recent',
}

export function generateTransactionSummaryRoute({
  organization,
  subPath,
  view,
}: {
  organization: Organization;
  subPath?: string;
  view?: DomainView; // TODO - this should be mantatory once we release domain view
}): string {
  return `${getTransactionSummaryBaseUrl(organization, view)}/${subPath ? `${subPath}/` : ''}`;
}

// normalizes search conditions by removing any redundant search conditions before presenting them in:
// - query strings
// - search UI
export function normalizeSearchConditions(query: string): MutableSearch {
  const filterParams = normalizeSearchConditionsWithTransactionName(query);

  // no need to include transaction as its already in the query params
  filterParams.removeFilter('transaction');

  return filterParams;
}

// normalizes search conditions by removing any redundant search conditions, but retains any transaction name
export function normalizeSearchConditionsWithTransactionName(
  query: string
): MutableSearch {
  const filterParams = new MutableSearch(query);

  // remove any event.type queries since it is implied to apply to only transactions
  filterParams.removeFilter('event.type');

  return filterParams;
}

export function transactionSummaryRouteWithQuery({
  organization,
  transaction,
  projectID,
  query,
  unselectedSeries = ['p100()', 'avg()'],
  display,
  trendFunction,
  trendColumn,
  showTransactions,
  additionalQuery,
  subPath,
  view,
}: {
  organization: Organization;
  query: Query;
  transaction: string;
  additionalQuery?: Record<string, string | undefined>;
  display?: DisplayModes;
  projectID?: string | string[];
  showTransactions?: TransactionFilterOptions;
  subPath?: string;
  trendColumn?: string;
  trendFunction?: string;
  unselectedSeries?: string | string[];
  view?: DomainView;
}) {
  const pathname = generateTransactionSummaryRoute({
    organization,
    subPath,
    view,
  });

  let searchFilter: typeof query.query;
  if (typeof query.query === 'string') {
    searchFilter = normalizeSearchConditions(query.query).formatString();
  } else {
    searchFilter = query.query;
  }

  return {
    pathname,
    query: {
      transaction,
      project: projectID,
      environment: query.environment,
      statsPeriod: query.statsPeriod,
      start: query.start,
      end: query.end,
      query: searchFilter,
      unselectedSeries,
      showTransactions,
      display,
      trendFunction,
      trendColumn,
      referrer: 'performance-transaction-summary',
      ...additionalQuery,
    },
  };
}

export function generateTraceLink(dateSelection: any, view?: DomainView) {
  return (
    organization: Organization,
    tableRow: TableDataRow,
    location: Location
  ): LocationDescriptor => {
    const traceId = `${tableRow.trace}`;
    if (!traceId) {
      return {};
    }

    return getTraceDetailsUrl({
      organization,
      traceSlug: traceId,
      dateSelection,
      timestamp: tableRow.timestamp,
      location,
      source: TraceViewSources.PERFORMANCE_TRANSACTION_SUMMARY,
      view,
    });
  };
}

export function generateTransactionIdLink(transactionName?: string, view?: DomainView) {
  return (
    organization: Organization,
    tableRow: TableDataRow,
    location: Location,
    spanId?: string
  ): LocationDescriptor => {
    return generateLinkToEventInTraceView({
      eventId: tableRow.id,
      timestamp: tableRow.timestamp!,
      traceSlug: tableRow.trace?.toString()!,
      projectSlug: tableRow['project.name']?.toString()!,
      location,
      organization,
      spanId,
      transactionName,
      source: TraceViewSources.PERFORMANCE_TRANSACTION_SUMMARY,
      view,
    });
  };
}

export function generateProfileLink() {
  return (
    organization: Organization,
    tableRow: TableDataRow,
    _location: Location | undefined
  ) => {
    const projectSlug = tableRow['project.name'];

    const profileId = tableRow['profile.id'];
    if (projectSlug && profileId) {
      return generateProfileFlamechartRoute({
        organization,
        projectSlug: String(tableRow['project.name']),
        profileId: String(profileId),
      });
    }

    const profilerId = tableRow['profiler.id'];
    const threadId = tableRow['thread.id'];
    const start =
      typeof tableRow['precise.start_ts'] === 'number'
        ? getDateFromTimestamp(tableRow['precise.start_ts'] * 1000)
        : null;
    const finish =
      typeof tableRow['precise.finish_ts'] === 'number'
        ? getDateFromTimestamp(tableRow['precise.finish_ts'] * 1000)
        : null;
    if (projectSlug && profilerId && threadId && start && finish) {
      const query: Record<string, string> = {tid: String(threadId)};
      if (tableRow.id && tableRow.trace) {
        query.eventId = String(tableRow.id);
        query.traceId = String(tableRow.trace);
      }

      return generateContinuousProfileFlamechartRouteWithQuery({
        organization,
        projectSlug: String(projectSlug),
        profilerId: String(profilerId),
        start: start.toISOString(),
        end: finish.toISOString(),
        query,
      });
    }

    return {};
  };
}

export function generateReplayLink(routes: Array<PlainRoute<any>>) {
  const referrer = getRouteStringFromRoutes(routes);

  return (
    organization: Organization,
    tableRow: TableDataRow,
    _location: Location | undefined
  ): LocationDescriptor => {
    const replayId = tableRow.replayId;
    if (!replayId) {
      return {};
    }

    if (!tableRow.timestamp) {
      return {
        pathname: makeReplaysPathname({
          path: `/${replayId}/`,
          organization,
        }),
        query: {
          referrer,
        },
      };
    }

    const transactionTimestamp = new Date(tableRow.timestamp).getTime();
    const transactionStartTimestamp = tableRow['transaction.duration']
      ? transactionTimestamp - (tableRow['transaction.duration'] as number)
      : undefined;

    return {
      pathname: makeReplaysPathname({
        path: `/${replayId}/`,
        organization,
      }),
      query: {
        event_t: transactionStartTimestamp,
        referrer,
      },
    };
  };
}

export function getTransactionSummaryBaseUrl(
  organization: Organization,
  view?: DomainView,
  bare: boolean = false
) {
  const hasPerfLandingRemovalFlag = organization?.features.includes(
    'insights-performance-landing-removal'
  );

  // Eventually the performance landing page will be removed, so there is no need to rely on `getPerformanceBaseUrl`
  if (hasPerfLandingRemovalFlag) {
    const url = view
      ? `${DOMAIN_VIEW_BASE_URL}/${view}/summary`
      : `${DOMAIN_VIEW_BASE_URL}/summary`;

    return bare ? url : normalizeUrl(`/organizations/${organization.slug}/${url}`);
  }
  return `${getPerformanceBaseUrl(organization.slug, view, bare)}/summary`;
}

export const SidebarSpacer = styled('div')`
  margin-top: ${space(3)};
`;
