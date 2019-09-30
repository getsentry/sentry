import {Trigger, AlertRuleThresholdType} from '../types';

export default function getTriggerConditionDisplayName(
  trigger: Trigger
): [string, string | null] {
  if (trigger.thresholdType === AlertRuleThresholdType.ABOVE) {
    return [
      `> ${trigger.alertThreshold}`,
      typeof trigger.resolveThreshold !== 'undefined' && trigger.resolveThreshold !== null
        ? `Auto-resolves when metric falls below ${trigger.resolveThreshold}`
        : null,
    ];
  } else {
    return [
      `< ${trigger.alertThreshold}`,
      typeof trigger.resolveThreshold !== 'undefined' && trigger.resolveThreshold !== null
        ? `Auto-resolves when metric is above ${trigger.resolveThreshold}`
        : null,
    ];
  }
}
