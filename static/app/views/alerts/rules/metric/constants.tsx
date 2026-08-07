import {parseFunction} from 'sentry/utils/discover/fields';
import {AlertRuleComparisonType} from 'sentry/views/alerts/rules/metric/types';
import {isSessionAggregate} from 'sentry/views/alerts/utils';

/**
 * Create an unsaved alert from a discover EventView object
 */
export function getThresholdUnits(
  aggregate: string,
  comparisonType: AlertRuleComparisonType
): string {
  // cls is a number not a measurement of time
  if (
    isSessionAggregate(aggregate) ||
    comparisonType === AlertRuleComparisonType.CHANGE
  ) {
    return '%';
  }

  const parsed = parseFunction(aggregate);
  if (parsed?.name === 'count') {
    return '';
  }

  if (aggregate.includes('measurements.cls')) {
    return '';
  }

  if (aggregate.includes('duration') || aggregate.includes('measurements')) {
    return 'ms';
  }

  return '';
}
