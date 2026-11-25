import {MutableSearch} from 'sentry/components/searchSyntax/mutableSearch';
import {useOrganization} from 'sentry/utils/useOrganization';
import type {TraceMetric} from 'sentry/views/explore/metrics/metricQuery';
import {createTraceMetricFilter} from 'sentry/views/explore/metrics/utils';

/**
 * Can be simplified once the flag is removed.
 */
export function useTraceMetricFilter(
  traceMetric: TraceMetric | undefined
): string | undefined {
  const organization = useOrganization();

  if (!traceMetric?.name) {
    return undefined;
  }

  if (organization.features.includes('tracemetrics-cooccurring-name-only')) {
    return MutableSearch.fromQueryObject({
      [`sentry._internal.cooccuring.name.${traceMetric.name}`]: ['true'],
    }).formatString();
  }

  return createTraceMetricFilter(traceMetric);
}
