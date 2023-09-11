import {AggregationKey} from 'sentry/utils/fields';
import {isOnDemandAggregate, isOnDemandQueryString} from 'sentry/utils/onDemandMetrics';
import {Dataset} from 'sentry/views/alerts/rules/metric/types';

export function isValidOnDemandMetricAlert(
  dataset: Dataset,
  aggregate: string,
  query: string
): boolean {
  // On demand metric alerts do not support generic percentile aggregations
  if (aggregate.includes(AggregationKey.PERCENTILE)) {
    return false;
  }

  return isOnDemandMetricAlert(dataset, aggregate, query);
}

/**
 * We determine that an alert is an on-demand metric alert if the query contains
 * one of the tags that are not supported by the standard metrics.
 */
export function isOnDemandMetricAlert(
  dataset: Dataset,
  aggregate: string,
  query: string
): boolean {
  if (isOnDemandAggregate(aggregate)) {
    return true;
  }
  return dataset === Dataset.GENERIC_METRICS && isOnDemandQueryString(query);
}
