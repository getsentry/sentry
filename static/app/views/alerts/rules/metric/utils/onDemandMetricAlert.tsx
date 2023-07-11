import {AggregationKey} from 'sentry/utils/fields';
import {ON_DEMAND_METRICS_SUPPORTED_TAGS} from 'sentry/views/alerts/wizard/options';

/**
 * We determine that an alert is an on-demand metric alert if the query contains
 * one of the tags that are supported for on-demand metrics
 */
export function isOnDemandMetricAlert(query: string): boolean {
  return ON_DEMAND_METRICS_SUPPORTED_TAGS.some(tag => query.includes(tag));
}

export function isValidOnDemandMetricAlert(aggregate: string, query: string): boolean {
  if (!isOnDemandMetricAlert(query)) {
    return true;
  }

  const unsupportedAggregates = [
    AggregationKey.PERCENTILE,
    AggregationKey.APDEX,
    AggregationKey.FAILURE_RATE,
  ];

  return !unsupportedAggregates.some(agg => aggregate.includes(agg));
}
