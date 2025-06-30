import type {FieldValue} from 'sentry/components/forms/model';
import type {Automation, NewAutomation} from 'sentry/types/workflowEngine/automations';
import type {AutomationBuilderState} from 'sentry/views/automations/components/automationBuilderContext';

export interface AutomationFormData {
  detectorIds: string[];
  environment: string | null;
  frequency: number | null;
  name: string;
}

export function getNewAutomationData(
  data: AutomationFormData,
  state: AutomationBuilderState
): NewAutomation {
  const stripDataConditionIds = (condition: any) => {
    const {id: _id, ...conditionWithoutId} = condition;
    return conditionWithoutId;
  };

  const stripActionIds = (action: any) => {
    const {id: _id, ...actionWithoutId} = action;
    return actionWithoutId;
  };

  const stripDataConditionGroupIds = (group: any) => {
    const {id: _id, ...groupWithoutId} = group;
    return {
      ...groupWithoutId,
      conditions: group.conditions?.map(stripDataConditionIds) || [],
      actions: group.actions?.map(stripActionIds) || [],
    };
  };

  const result = {
    name: data.name,
    triggers: stripDataConditionGroupIds(state.triggers),
    environment: data.environment,
    actionFilters: state.actionFilters.map(stripDataConditionGroupIds),
    config: {
      frequency: data.frequency ?? undefined,
    },
    detectorIds: data.detectorIds,
  };
  return result;
}

export function getAutomationFormData(
  automation: Automation
): Record<string, FieldValue> {
  return {
    detectorIds: automation.detectorIds,
    environment: automation.environment,
    frequency: automation.config.frequency || null,
    name: automation.name,
  };
}
