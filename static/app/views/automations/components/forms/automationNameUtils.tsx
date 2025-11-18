import {ActionMetadata} from 'sentry/components/workflowEngine/ui/actionMetadata';
import {t} from 'sentry/locale';
import {ActionTarget, ActionType, type Action} from 'sentry/types/workflowEngine/actions';
import type {AutomationBuilderState} from 'sentry/views/automations/components/automationBuilderContext';

const MAX_ACTIONS_IN_NAME = 3;
const MAX_NAME_LENGTH = 256;

/**
 * Gets a human-readable description of a single action
 */
export function getActionDescription(action: Action): string {
  switch (action.type) {
    case ActionType.EMAIL: {
      if (action.config.targetType === ActionTarget.ISSUE_OWNERS) {
        return t('Notify Suggested Assignees');
      }
      if (action.config.targetType === ActionTarget.TEAM) {
        return t(
          'Notify team%s',
          action.config.targetDisplay ? ` #${action.config.targetDisplay}` : ''
        );
      }
      return t('Notify %s', action.config.targetDisplay || t('member'));
    }
    case ActionType.SENTRY_APP:
    case ActionType.WEBHOOK:
      return t(
        'Notify via %s',
        action.config.targetDisplay || ActionMetadata[action.type]?.name
      );
    default:
      return t(
        'Notify%s via %s',
        action.config.targetDisplay ? ` ${action.config.targetDisplay}` : '',
        ActionMetadata[action.type]?.name
      );
  }
}

/**
 * Gets a human-readable description of the actions in the automation
 */
export function getAutomationName(builderState: AutomationBuilderState): string {
  const allActions = builderState.actionFilters.flatMap(group => group.actions || []);

  if (allActions.length === 0) {
    return '';
  }

  const count = allActions.length;
  const actionDescriptions = allActions
    .slice(0, MAX_ACTIONS_IN_NAME)
    .map(getActionDescription);

  // Start with all actions joined, then incrementally remove from the end if too long
  let actionsToInclude = actionDescriptions.length;
  let automationName = '';

  while (actionsToInclude > 0) {
    // Build name with current number of actions
    automationName = actionDescriptions.slice(0, actionsToInclude).join(', ');

    // Calculate remaining count for the suffix
    const remainingCount = count - actionsToInclude;
    const countSuffix = remainingCount > 0 ? t(' (+%s)', remainingCount) : '';

    // Check if the full name fits within the limit
    if (automationName.length + countSuffix.length <= MAX_NAME_LENGTH) {
      automationName += countSuffix;
      break;
    }

    // If it doesn't fit, try with one fewer action
    actionsToInclude--;
  }

  // Fallback if even a single action is too long
  if (actionsToInclude === 0) {
    if (count === 0) {
      automationName = '';
    } else {
      automationName = t('New Alert (%s actions)', count);
    }
  }

  return automationName;
}

// Export constants for testing
export {MAX_ACTIONS_IN_NAME, MAX_NAME_LENGTH};
