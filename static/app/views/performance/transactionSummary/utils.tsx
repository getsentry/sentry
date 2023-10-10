import {PlainRoute} from 'react-router';
import styled from '@emotion/styled';
import {LocationDescriptor, Query} from 'history';

import {space} from 'sentry/styles/space';
import {Organization} from 'sentry/types';
import {TableDataRow} from 'sentry/utils/discover/discoverQuery';
import {generateEventSlug} from 'sentry/utils/discover/urls';
import getRouteStringFromRoutes from 'sentry/utils/getRouteStringFromRoutes';
import {getTransactionDetailsUrl} from 'sentry/utils/performance/urls';
import {generateProfileFlamechartRoute} from 'sentry/utils/profiling/routes';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {normalizeUrl} from 'sentry/utils/withDomainRequired';
import {getTraceDetailsUrl} from 'sentry/views/performance/traceDetails/utils';

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
  orgSlug,
  subPath,
}: {
  orgSlug: string;
  subPath?: string;
}): string {
  return `/organizations/${orgSlug}/performance/summary/${subPath ? `${subPath}/` : ''}`;
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
  orgSlug,
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
}: {
  orgSlug: string;
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
}) {
  const pathname = generateTransactionSummaryRoute({
    orgSlug,
    subPath,
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

export function generateTraceLink(dateSelection) {
  return (
    organization: Organization,
    tableRow: TableDataRow,
    _query: Query
  ): LocationDescriptor => {
    const traceId = `${tableRow.trace}`;
    if (!traceId) {
      return {};
    }

    return getTraceDetailsUrl(organization, traceId, dateSelection, {});
  };
}

export function generateTransactionLink(transactionName: string) {
  return (
    organization: Organization,
    tableRow: TableDataRow,
    query: Query,
    spanId?: string
  ): LocationDescriptor => {
    const eventSlug = generateEventSlug(tableRow);
    return getTransactionDetailsUrl(
      organization.slug,
      eventSlug,
      transactionName,
      query,
      spanId
    );
  };
}

export function generateProfileLink() {
  return (
    organization: Organization,
    tableRow: TableDataRow,
    _query: Query | undefined
  ) => {
    const profileId = tableRow['profile.id'];
    if (!profileId) {
      return {};
    }
    return generateProfileFlamechartRoute({
      orgSlug: organization.slug,
      projectSlug: String(tableRow['project.name']),
      profileId: String(profileId),
    });
  };
}

export function generateReplayLink(routes: PlainRoute<any>[]) {
  const referrer = getRouteStringFromRoutes(routes);

  return (
    organization: Organization,
    tableRow: TableDataRow,
    _query: Query | undefined
  ): LocationDescriptor => {
    const replayId = tableRow.replayId;
    if (!replayId) {
      return {};
    }

    if (!tableRow.timestamp) {
      return {
        pathname: normalizeUrl(
          `/organizations/${organization.slug}/replays/${replayId}/`
        ),
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
      pathname: normalizeUrl(`/organizations/${organization.slug}/replays/${replayId}/`),
      query: {
        event_t: transactionStartTimestamp,
        referrer,
      },
    };
  };
}
export const SidebarSpacer = styled('div')`
  margin-top: ${space(3)};
`;
