import styled from '@emotion/styled';
import {LocationDescriptor, Query} from 'history';

import space from 'sentry/styles/space';
import {Organization} from 'sentry/types';
import {TableDataRow} from 'sentry/utils/discover/discoverQuery';
import {generateEventSlug} from 'sentry/utils/discover/urls';
import {getTransactionDetailsUrl} from 'sentry/utils/performance/urls';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {getTraceDetailsUrl} from 'sentry/views/performance/traceDetails/utils';

import {DisplayModes} from './transactionOverview/charts';

export enum TransactionFilterOptions {
  FASTEST = 'fastest',
  SLOW = 'slow',
  OUTLIER = 'outlier',
  RECENT = 'recent',
}

export function generateTransactionSummaryRoute({orgSlug}: {orgSlug: String}): string {
  return `/organizations/${orgSlug}/performance/summary/`;
}

function cleanTransactionSummaryFilter(query: string): string {
  const filterParams = new MutableSearch(query);
  filterParams.removeFilter('transaction');
  filterParams.removeFilter('event.type');
  return filterParams.formatString();
}

export function transactionSummaryRouteWithQuery({
  orgSlug,
  transaction,
  projectID,
  query,
  unselectedSeries = 'p100()',
  display,
  trendFunction,
  trendColumn,
  showTransactions,
  additionalQuery,
}: {
  orgSlug: string;
  query: Query;
  transaction: string;
  additionalQuery?: Record<string, string>;
  display?: DisplayModes;
  projectID?: string | string[];
  showTransactions?: TransactionFilterOptions;
  trendColumn?: string;
  trendFunction?: string;
  unselectedSeries?: string | string[];
}) {
  const pathname = generateTransactionSummaryRoute({
    orgSlug,
  });

  let searchFilter: typeof query.query;
  if (typeof query.query === 'string') {
    searchFilter = cleanTransactionSummaryFilter(query.query);
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

export const SidebarSpacer = styled('div')`
  margin-top: ${space(3)};
`;
