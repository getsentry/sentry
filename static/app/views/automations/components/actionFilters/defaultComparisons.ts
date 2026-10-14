import {DataConditionType} from 'sentry/types/workflowEngine/dataConditions';

import {Interval} from './constants';

/**
 * Default comparison values for condition types that have a "count vs percent"
 * sub-type selector. Extracted here to avoid a circular import between
 * dataConditionNodes.tsx (which imports the action-filter components) and the
 * action-filter components that need these defaults.
 */
export const dataConditionDefaultComparisons = new Map<
  DataConditionType,
  Record<string, unknown>
>([
  [
    DataConditionType.EVENT_FREQUENCY_COUNT,
    {value: 100, interval: Interval.ONE_HOUR},
  ],
  [
    DataConditionType.EVENT_FREQUENCY_PERCENT,
    {value: 100, interval: Interval.ONE_HOUR, comparisonInterval: Interval.ONE_WEEK},
  ],
  [
    DataConditionType.EVENT_UNIQUE_USER_FREQUENCY_COUNT,
    {value: 100, interval: Interval.ONE_HOUR},
  ],
  [
    DataConditionType.EVENT_UNIQUE_USER_FREQUENCY_PERCENT,
    {value: 100, interval: Interval.ONE_HOUR, comparisonInterval: Interval.ONE_WEEK},
  ],
  [
    DataConditionType.PERCENT_SESSIONS_COUNT,
    {value: 100, interval: Interval.ONE_HOUR},
  ],
  [
    DataConditionType.PERCENT_SESSIONS_PERCENT,
    {value: 100, interval: Interval.ONE_HOUR, comparisonInterval: Interval.ONE_WEEK},
  ],
]);
