import {t} from 'sentry/locale';
import type {AnomalyDetectionComparison} from 'sentry/types/workflowEngine/detectors';
import {
  AlertRuleSensitivity,
  AlertRuleThresholdType,
} from 'sentry/views/alerts/rules/metric/types';

/**
 * Type guard to check if a condition comparison is an anomaly detection comparison
 */
export function isAnomalyDetectionComparison(
  comparison: unknown
): comparison is AnomalyDetectionComparison {
  return (
    typeof comparison === 'object' &&
    comparison !== null &&
    'sensitivity' in comparison &&
    'thresholdType' in comparison
  );
}

/**
 * Get the display label for an anomaly detection sensitivity level
 */
export function getSensitivityLabel(sensitivity: AlertRuleSensitivity): string {
  switch (sensitivity) {
    case AlertRuleSensitivity.HIGH:
      return t('High');
    case AlertRuleSensitivity.MEDIUM:
      return t('Medium');
    case AlertRuleSensitivity.LOW:
      return t('Low');
    default:
      return t('Unknown');
  }
}

/**
 * Get the display label for an anomaly detection threshold type (direction)
 */
export function getThresholdTypeLabel(thresholdType: AlertRuleThresholdType): string {
  switch (thresholdType) {
    case AlertRuleThresholdType.ABOVE:
      return t('Above');
    case AlertRuleThresholdType.BELOW:
      return t('Below');
    case AlertRuleThresholdType.ABOVE_AND_BELOW:
      return t('Above and Below');
    default:
      return t('Unknown');
  }
}
