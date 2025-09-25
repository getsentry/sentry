import {aggregateOutputType} from 'sentry/utils/discover/fields';
import {
  DERIVED_STATUS_METRICS_PATTERN,
  SESSIONS_TAGS,
} from 'sentry/views/dashboards/widgetBuilder/releaseWidget/fields';
import {derivedMetricsToField} from 'sentry/views/dashboards/widgetCard/releaseWidgetQueries';

export function changeObjectValuesToTypes(
  obj: Record<string, number | string | null> | undefined
) {
  return Object.keys(obj ?? {}).reduce((acc, key) => {
    // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
    acc[key] = SESSIONS_TAGS.includes(key) ? 'string' : aggregateOutputType(key);
    return acc;
  }, {});
}

export function mapDerivedMetricsToFields(results: Record<string, number | null>) {
  const mappedResults: Record<string, number | null> = {};
  for (const [key, value] of Object.entries(results)) {
    mappedResults[derivedMetricsToField(key)] = value;
  }
  return mappedResults;
}

export function getDerivedMetrics(
  groupBy: any,
  totals: any,
  requestedStatusMetrics: any
) {
  const derivedTotals = {};
  if (!requestedStatusMetrics.length) {
    return derivedTotals;
  }
  if (groupBy['session.status'] === undefined) {
    return derivedTotals;
  }
  requestedStatusMetrics.forEach((status: any) => {
    const result = status.match(DERIVED_STATUS_METRICS_PATTERN);
    if (result) {
      if (groupBy['session.status'] === result[1]) {
        if (result[2] === 'session') {
          // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
          derivedTotals[status] = totals['sum(session)'];
        } else if (result[2] === 'user') {
          // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
          derivedTotals[status] = totals['count_unique(user)'];
        }
      } else {
        // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
        derivedTotals[status] = 0;
      }
    }
  });
  return derivedTotals;
}
