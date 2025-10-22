import {MutableSearch} from 'sentry/components/searchSyntax/mutableSearch';
import normalizeUrl from 'sentry/utils/url/normalizeUrl';

export function makeMetricsPathname({
  organizationSlug,
  path,
}: {
  organizationSlug: string;
  path: string;
}) {
  return normalizeUrl(`/organizations/${organizationSlug}/explore/metrics${path}`);
}

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
