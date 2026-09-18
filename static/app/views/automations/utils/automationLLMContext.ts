import type {Action} from 'sentry/types/workflowEngine/actions';
import type {DataConditionGroup} from 'sentry/types/workflowEngine/dataConditions';

/**
 * An action as the agent needs to see it: what it does *and* where it lands.
 * `targetDisplay` is the resolved channel/team/user name — "sends a Slack
 * notification" is not an answer to "which channel?", which is the gap this
 * node exists to close. `targetIdentifier` is the raw id behind it.
 *
 * Fields are enumerated rather than spread: `Action.data` is an untyped bag
 * that carries integration payloads, and nothing here needs it.
 */
function actionToLLMContext(action: Action) {
  return {
    type: action.type,
    targetType: action.config.targetType,
    targetIdentifier: action.config.targetIdentifier,
    targetDisplay: action.config.targetDisplay,
  };
}

/**
 * Summarize a condition group — the logic type plus each condition's type and
 * comparison. Actions are included only when the group has them, so a trigger
 * group does not report an empty `actions` list.
 */
export function dataConditionGroupToLLMContext(group: DataConditionGroup) {
  return {
    logicType: group.logicType,
    conditions: group.conditions.map(condition => ({
      type: condition.type,
      comparison: condition.comparison,
    })),
    ...(group.actions && {actions: group.actions.map(actionToLLMContext)}),
  };
}
