import {t} from 'app/locale';

import {Trigger, AlertRuleThresholdType} from '../types';

export default function getTriggerConditionDisplayName(
  trigger: Trigger
): [string, string | null] {
  if (trigger.thresholdType === AlertRuleThresholdType.ABOVE) {
    return [
      `> ${trigger.alertThreshold}`,
      typeof trigger.resolveThreshold !== 'undefined' && trigger.resolveThreshold !== null
        ? t('Auto-resolves when metric falls below %s', trigger.resolveThreshold)
        : null,
    ];
  } else {
    return [
      `< ${trigger.alertThreshold}`,
      typeof trigger.resolveThreshold !== 'undefined' && trigger.resolveThreshold !== null
        ? t('Auto-resolves when metric is above %s', trigger.resolveThreshold)
        : null,
    ];
  }
}
