import type {FieldValue} from 'sentry/components/forms/model';
import {t} from 'sentry/locale';
import type {Action} from 'sentry/types/workflowEngine/actions';
import type {Automation, NewAutomation} from 'sentry/types/workflowEngine/automations';
import type {DataCondition} from 'sentry/types/workflowEngine/dataConditions';
import {actionNodesMap} from 'sentry/views/automations/components/actionNodes';
import type {AutomationBuilderState} from 'sentry/views/automations/components/automationBuilderContext';
import {dataConditionNodesMap} from 'sentry/views/automations/components/dataConditionNodes';

export interface AutomationFormData {
  detectorIds: string[];
  environment: string | null;
  frequency: number | null;
  name: string;
}

const stripDataConditionId = (condition: any) => {
  const {id: _id, ...conditionWithoutId} = condition;

  if (condition.comparison?.filters) {
    return {
      ...conditionWithoutId,
      comparison: {
        ...condition.comparison,
        filters: condition.comparison.filters?.map(stripSubfilterTypeAndId) || [],
      },
    };
  }
  return conditionWithoutId;
};

// subfilters have a `type` for the frontend to distinguish between attribute and tag comparisons, but this is not expected by the backend
const stripSubfilterTypeAndId = (subfilter: any) => {
  const {id: _id, type: _type, ...subfilterWithoutTypeAndId} = subfilter;
  return subfilterWithoutTypeAndId;
};

const stripActionId = (action: any) => {
  const {id: _id, ...actionWithoutId} = action;
  return actionWithoutId;
};

const stripDataConditionGroupId = (group: any) => {
  const {id: _id, ...groupWithoutId} = group;
  return {
    ...groupWithoutId,
    conditions: group.conditions?.map(stripDataConditionId) || [],
    actions: group.actions?.map(stripActionId) || [],
  };
};

export function getNewAutomationData(
  data: AutomationFormData,
  state: AutomationBuilderState
): NewAutomation {
  const result = {
    name: data.name,
    triggers: stripDataConditionGroupId(state.triggers),
    environment: data.environment,
    actionFilters: state.actionFilters.map(stripDataConditionGroupId),
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

export interface ValidateDataConditionProps {
  condition: DataCondition;
}

export function validateAutomationBuilderState(state: AutomationBuilderState) {
  const errors: Record<string, string> = {};
  // validate trigger conditions
  for (const condition of state.triggers.conditions || []) {
    const validationResult = dataConditionNodesMap
      .get(condition.type)
      ?.validate?.({condition});
    if (validationResult) {
      errors[condition.id] = validationResult;
    }
  }

  // validate action filters
  for (const actionFilter of state.actionFilters) {
    // validate action filter conditions
    for (const condition of actionFilter.conditions || []) {
      const validationResult = dataConditionNodesMap
        .get(condition.type)
        ?.validate?.({condition});
      if (validationResult) {
        errors[condition.id] = validationResult;
      }
    }
    // validate action filter actions
    if (actionFilter.actions?.length === 0) {
      errors[actionFilter.id] = t('You must add an action for this automation to run.');
      continue;
    }
    for (const action of actionFilter.actions || []) {
      const validationResult = actionNodesMap.get(action.type)?.validate?.(action);
      if (validationResult) {
        errors[action.id] = validationResult;
      }
    }
  }
  return errors;
}

export function validateActions({actions}: {actions: Action[]}): Record<string, string> {
  const errors: Record<string, string> = {};

  for (const action of actions) {
    const validationResult = actionNodesMap.get(action.type)?.validate?.(action);
    if (validationResult) {
      errors[action.id] = validationResult;
    }
  }
  return errors;
}
