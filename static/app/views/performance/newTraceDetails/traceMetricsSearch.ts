import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {TraceMetricKnownFieldKey} from 'sentry/views/explore/metrics/types';

export const EXCLUDE_SPAN_METRICS_QUERY =
  '(!has:sentry.metric.source OR !sentry.metric.source:span)';

export function getTraceMetricsSearch(traceSlug: string) {
  const search = new MutableSearch(EXCLUDE_SPAN_METRICS_QUERY);
  search.addFilterValue(TraceMetricKnownFieldKey.TRACE, traceSlug);
  return search;
}
