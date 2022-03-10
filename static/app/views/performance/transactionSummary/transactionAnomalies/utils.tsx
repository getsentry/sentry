import {Location, Query} from 'history';

import EventView from 'sentry/utils/discover/eventView';
import {AnomalyConfidence} from 'sentry/utils/performance/anomalies/anomaliesQuery';
import {decodeScalar} from 'sentry/utils/queryString';
import {Theme} from 'sentry/utils/theme';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';

export function generateAnomaliesRoute({orgSlug}: {orgSlug: String}): string {
  return `/organizations/${orgSlug}/performance/summary/anomalies/`;
}

export const ANOMALY_FLAG = 'performance-anomaly-detection-ui';

export function anomaliesRouteWithQuery({
  orgSlug,
  transaction,
  projectID,
  query,
}: {
  orgSlug: string;
  query: Query;
  transaction: string;
  projectID?: string | string[];
}) {
  const pathname = generateAnomaliesRoute({
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
