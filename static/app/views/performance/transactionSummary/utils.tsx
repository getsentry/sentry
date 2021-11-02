import styled from '@emotion/styled';
import {LocationDescriptor, Query} from 'history';

import space from 'app/styles/space';
import {Organization} from 'app/types';
import {TableDataRow} from 'app/utils/discover/discoverQuery';
import {generateEventSlug} from 'app/utils/discover/urls';
import {getTraceDetailsUrl} from 'app/views/performance/traceDetails/utils';

import {getTransactionDetailsUrl} from '../utils';

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
  transaction: string;
  query: Query;
  display?: DisplayModes;
  trendFunction?: string;
  trendColumn?: string;
  unselectedSeries?: string | string[];
  projectID?: string | string[];
  showTransactions?: TransactionFilterOptions;
  additionalQuery?: Record<string, string>;
}) {
  const pathname = generateTransactionSummaryRoute({
    orgSlug,
  });

  return {
    pathname,
    query: {
      transaction,
      project: projectID,
      environment: query.environment,
      statsPeriod: query.statsPeriod,
      start: query.start,
      end: query.end,
      query: query.query,
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
    hash?: string
  ): LocationDescriptor => {
    const eventSlug = generateEventSlug(tableRow);
    return getTransactionDetailsUrl(
      organization,
      eventSlug,
      transactionName,
      query,
      hash
    );
  };
}

export const SidebarSpacer = styled('div')`
  margin-top: ${space(3)};
`;
