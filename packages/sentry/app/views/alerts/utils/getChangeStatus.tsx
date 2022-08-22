import {
  AlertRuleThresholdType,
  AlertRuleTriggerType,
  Trigger,
} from 'sentry/views/alerts/rules/metric/types';

export const getChangeStatus = (
  value: number,
  thresholdType: AlertRuleThresholdType,
  triggers: Trigger[]
): string => {
  const criticalTrigger = triggers?.find(
    trig => trig.label === AlertRuleTriggerType.CRITICAL
  );
  const warningTrigger = triggers?.find(
    trig => trig.label === AlertRuleTriggerType.WARNING
  );
  const criticalTriggerAlertThreshold =
    typeof criticalTrigger?.alertThreshold === 'number'
      ? criticalTrigger.alertThreshold
      : undefined;
  const warningTriggerAlertThreshold =
    typeof warningTrigger?.alertThreshold === 'number'
      ? warningTrigger.alertThreshold
      : undefined;

  // Need to catch the critical threshold cases before warning threshold cases
  if (
    thresholdType === AlertRuleThresholdType.ABOVE &&
    criticalTriggerAlertThreshold &&
    value >= criticalTriggerAlertThreshold
  ) {
    return AlertRuleTriggerType.CRITICAL;
  }
  if (
    thresholdType === AlertRuleThresholdType.ABOVE &&
    warningTriggerAlertThreshold &&
    value >= warningTriggerAlertThreshold
  ) {
    return AlertRuleTriggerType.WARNING;
  }
  // When threshold is below(lower than in comparison alerts) the % diff value is negative
  // It crosses the threshold if its abs value is greater than threshold
  // -80% change crosses below 60% threshold -1 * (-80) > 60
  if (
    thresholdType === AlertRuleThresholdType.BELOW &&
    criticalTriggerAlertThreshold &&
    -1 * value >= criticalTriggerAlertThreshold
  ) {
    return AlertRuleTriggerType.CRITICAL;
  }
  if (
    thresholdType === AlertRuleThresholdType.BELOW &&
    warningTriggerAlertThreshold &&
    -1 * value >= warningTriggerAlertThreshold
  ) {
    return AlertRuleTriggerType.WARNING;
  }

  return '';
};
