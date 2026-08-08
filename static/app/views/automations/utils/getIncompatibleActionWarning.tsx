import {t} from 'sentry/locale';
import type {ActionHandler} from 'sentry/types/workflowEngine/actions';
import type {DataCondition} from 'sentry/types/workflowEngine/dataConditions';

const INCOMPATIBILITY_MESSAGES: Record<string, string> = {
  seer_activity_trigger: t('This action is not supported for Seer activity triggers.'),
};

interface IncompatibleActionWarningContext {
  handler: ActionHandler;
  triggerConditions: DataCondition[];
}

/**
 * Returns all applicable warning messages for an action that is
 * incompatible with the current trigger or detector configuration.
 *
 * Incompatibilities are driven by the backend via the `incompatibleConditions`
 * field on each ActionHandler returned from the available-actions endpoint.
 */
export function getIncompatibleActionWarnings({
  handler,
  triggerConditions,
}: IncompatibleActionWarningContext): string[] {
  const incompatible = handler.incompatibleConditions;
  if (!incompatible?.length) {
    return [];
  }

  const activeConditionTypes = new Set(triggerConditions.map(c => c.type));
  const warnings: string[] = [];

  for (const conditionType of incompatible) {
    if (activeConditionTypes.has(conditionType as any)) {
      const message = INCOMPATIBILITY_MESSAGES[conditionType];
      if (message) {
        warnings.push(message);
      }
    }
  }

  return warnings;
}
