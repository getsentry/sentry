import {isOnDemandAggregate, isOnDemandQueryString} from 'sentry/utils/onDemandMetrics';
import {Dataset} from 'sentry/views/alerts/rules/metric/types';
import {isCustomMetricField} from 'sentry/views/alerts/rules/metric/utils/isCustomMetricField';

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
  // TODO: extend to also support other MRI use-cases
  if (isCustomMetricField(aggregate)) {
    return false;
  }
  return dataset === Dataset.GENERIC_METRICS && isOnDemandQueryString(query);
}
