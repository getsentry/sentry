import type {Theme} from '@emotion/react';
import type {Location, Query} from 'history';

import EventView from 'sentry/utils/discover/eventView';
import type {AnomalyConfidence} from 'sentry/utils/performance/anomalies/anomaliesQuery';
import {decodeScalar} from 'sentry/utils/queryString';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import type {DomainView} from 'sentry/views/insights/pages/useFilters';
import {getTransactionSummaryBaseUrl} from 'sentry/views/performance/transactionSummary/utils';

export function generateAnomaliesRoute({
  orgSlug,
  view,
}: {
  orgSlug: string;
  view?: DomainView;
}): string {
  return `${getTransactionSummaryBaseUrl(orgSlug, view)}/anomalies/`;
}

export const ANOMALY_FLAG = 'performance-anomaly-detection-ui';

export function anomaliesRouteWithQuery({
  orgSlug,
  transaction,
  projectID,
  query,
  view,
}: {
  orgSlug: string;
  query: Query;
  transaction: string;
  projectID?: string | string[];
  view?: DomainView;
}) {
  const pathname = generateAnomaliesRoute({
    orgSlug,
    view,
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
    },
  };
}

export function anomalyToColor(anomalyConfidence: AnomalyConfidence, theme: Theme) {
  // Map inside function so it's reactive to theme.
  const map: Record<AnomalyConfidence, string> = {
    high: theme.red300,
    low: theme.yellow300,
  };
  return map[anomalyConfidence];
}

export function generateAnomaliesEventView({
  location,
  transactionName,
}: {
  location: Location;
  transactionName: string;
}): EventView {
  const query = decodeScalar(location.query.query, '');
  const conditions = new MutableSearch(query);

  conditions.setFilterValues('transaction', [transactionName]);

  const eventView = EventView.fromNewQueryWithLocation(
    {
      id: undefined,
      version: 2,
      name: transactionName,
      fields: ['tpm()'], // TODO(k-fish): Modify depending on api url later.
      query: conditions.formatString(),
      projects: [],
    },
    location
  );

  return eventView;
}
