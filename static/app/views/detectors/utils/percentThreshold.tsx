import {DataConditionType} from 'sentry/types/workflowEngine/dataConditions';

/**
 * Converts a percent-change condition's absolute-percentage (e.g. 110) value to the
 * user-facing delta percentage value (e.g. 10% higher).
 *
 * The backend stores percent-change thresholds as absolute percentages of the baseline:
 *   - 110 means "the value is 110% of the baseline" → 10% higher
 *   - 60  means "the value is 60% of the baseline"  → 40% lower
 */
export function percentThresholdAbsoluteToDelta(comparison: number): number {
  if (comparison >= 100) {
    return comparison - 100;
  }
  return 100 - comparison;
}

/**
 * Converts a user-facing form value (delta percentage) to the backend
 * absolute-percentage condition comparison value.
 *
 * This is the inverse of {@link percentThresholdAbsoluteToDelta}.
 *
 *   - GREATER / LESS_OR_EQUAL: 10 → 110  (10% higher → value is 110% of baseline)
 *   - LESS / GREATER_OR_EQUAL: 40 → 60   (40% lower  → value is 60% of baseline)
 */
export function percentThresholdDeltaToAbsolute(
  delta: number,
  conditionType: DataConditionType
): number {
  if (
    conditionType === DataConditionType.GREATER ||
    conditionType === DataConditionType.LESS_OR_EQUAL
  ) {
    return delta + 100;
  }
  return 100 - delta;
}
