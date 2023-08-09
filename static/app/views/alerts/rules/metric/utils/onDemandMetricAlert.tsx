import {AggregationKey} from 'sentry/utils/fields';
import {isOnDemandQueryString} from 'sentry/utils/onDemandMetrics';
import {Dataset} from 'sentry/views/alerts/rules/metric/types';

export function isValidOnDemandMetricAlert(
  dataset: Dataset,
  aggregate: string,
  query: string
): boolean {
  if (!isOnDemandMetricAlert(dataset, query)) {
    return true;
  }

  const unsupportedAggregates = [
    AggregationKey.PERCENTILE,
    AggregationKey.APDEX,
    AggregationKey.FAILURE_RATE,
  ];

  return !unsupportedAggregates.some(agg => aggregate.includes(agg));
}

/**
 * We determine that an alert is an on-demand metric alert if the query contains
 * one of the tags that are not supported by the standard metrics.
 */
export function isOnDemandMetricAlert(dataset: Dataset, query: string): boolean {
  return dataset === Dataset.GENERIC_METRICS && isOnDemandQueryString(query);
}
