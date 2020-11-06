import {Query} from 'history';

import {TrendFunctionField} from '../trends/types';
import {DisplayModes} from './charts';

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
  trendDisplay,
}: {
  orgSlug: string;
  transaction: string;
  query: Query;
  display?: DisplayModes;
  trendDisplay?: TrendFunctionField;
  unselectedSeries?: string | string[];
  projectID?: string | string[];
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
      display,
      trendDisplay,
    },
  };
}
