import {useContext, useEffect} from 'react';
import {autorun} from 'mobx';

import FormContext from 'sentry/components/forms/formContext';
import {ActionMetadata} from 'sentry/components/workflowEngine/ui/actionMetadata';
import {t} from 'sentry/locale';
import {ActionTarget, ActionType, type Action} from 'sentry/types/workflowEngine/actions';
import type {AutomationBuilderState} from 'sentry/views/automations/components/automationBuilderContext';
import {useAutomationBuilderContext} from 'sentry/views/automations/components/automationBuilderContext';
import {useAutomationFormContext} from 'sentry/views/automations/components/forms/context';

const MAX_ACTIONS_IN_NAME = 3;

/**
 * Hook to automatically set the automation name based on automation builder state.
 */
export function useSetAutomaticAutomationName() {
  const {form} = useContext(FormContext);
  const {hasSetAutomationName, automation} = useAutomationFormContext();
  const {state: builderState} = useAutomationBuilderContext();

  // Use autorun for form reactivity and useEffect for builder state changes
  useEffect(() => {
    if (form === undefined || hasSetAutomationName) {
      return () => {};
    }

    // Don't auto-generate name if we're editing an existing automation
    if (automation) {
      return () => {};
    }

    return autorun(() => {
      const generatedName = getAutomationName(builderState);
      if (generatedName) {
        form.setValue('name', generatedName);
      }
    });
  }, [form, hasSetAutomationName, automation, builderState]);
}

/**
 * Gets a human-readable description of a single action
 */
function getActionDescription(action: Action): string {
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
function getAutomationName(builderState: AutomationBuilderState): string {
  const allActions = builderState.actionFilters.flatMap(group => group.actions || []);

  if (allActions.length === 0) {
    return 'New Alert';
  }

  const count = allActions.length;
  let automationName = '';

  for (let i = 0; i < Math.min(count, MAX_ACTIONS_IN_NAME); i++) {
    const action = allActions[i];
    if (action) {
      const actionDesc = getActionDescription(action);
      automationName += actionDesc + ', ';
    }
  }

  automationName = automationName.slice(0, -2); // Remove trailing comma and space

  if (count > MAX_ACTIONS_IN_NAME) {
    automationName += t(' (+%s)', count - MAX_ACTIONS_IN_NAME);
  }

  return automationName;
}
