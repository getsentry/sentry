import {MutableSearch} from 'sentry/components/searchSyntax/mutableSearch';

/**
 * Creates a filter string for co-occurring attributes based on a metric name.
 * This filter is used to narrow down attribute keys to only those that co-occur
 * with the specified metric.
 */
export function createMetricNameFilter(
  metricName: string | undefined
): string | undefined {
  return metricName
    ? MutableSearch.fromQueryObject({
        [`sentry._internal.cooccuring.name.${metricName}`]: ['true'],
      }).formatString()
    : undefined;
}
