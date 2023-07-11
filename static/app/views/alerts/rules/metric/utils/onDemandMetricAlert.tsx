import {AggregationKey} from 'sentry/utils/fields';

/**
 * Currently we determine that an alert is an on-demand metric alert if the query contains
 * the string 'transaction.duration'. This should be extended in the future
 */
export function isOnDemandMetricAlert(query: string): boolean {
  return query.includes('transaction.duration');
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
