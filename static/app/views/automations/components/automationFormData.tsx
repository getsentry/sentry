import {uuid4} from '@sentry/core';

import type {FieldValue} from 'sentry/components/forms/model';
import {t} from 'sentry/locale';
import {ActionType, type Action} from 'sentry/types/workflowEngine/actions';
import type {Automation, NewAutomation} from 'sentry/types/workflowEngine/automations';
import type {
  DataCondition,
  DataConditionGroup,
  Subfilter,
} from 'sentry/types/workflowEngine/dataConditions';
import {actionNodesMap} from 'sentry/views/automations/components/actionNodes';
import type {AutomationBuilderState} from 'sentry/views/automations/components/automationBuilderContext';
import {dataConditionNodesMap} from 'sentry/views/automations/components/dataConditionNodes';

export interface AutomationFormData {
  detectorIds: string[];
  enabled: boolean;
  environment: string | null;
  frequency: number | null;
  name: string;
  /**
   * Derived field used for project-based monitor selection.
   * Maps to issue stream detector IDs for the selected projects.
   */
  projectIds: string[];
}

const stripDataConditionId = (condition: any) => {
  const {id: _id, ...conditionWithoutId} = condition;

  if (condition.comparison?.filters) {
    return {
      ...conditionWithoutId,
      comparison: {
        ...condition.comparison,
        filters: condition.comparison.filters?.map(stripSubfilterId) || [],
      },
    };
  }
  return conditionWithoutId;
};

const stripSubfilterId = (subfilter: any) => {
  const {id: _id, ...subfilterWithoutId} = subfilter;
  return subfilterWithoutId;
};

export const stripActionFields = (action: Action) => {
  const {id: _id, ...actionWithoutId} = action;

  // Strip targetDisplay from email action config
  if ([ActionType.EMAIL, ActionType.WEBHOOK].includes(action.type) && action.config) {
    return {
      ...actionWithoutId,
      config: {...action.config, targetDisplay: null},
    };
  }

  return actionWithoutId;
};

const stripDataConditionGroupId = (group: any) => {
  const {id: _id, ...groupWithoutId} = group;
  return {
    ...groupWithoutId,
    conditions: group.conditions?.map(stripDataConditionId) || [],
    actions: group.actions?.map(stripActionFields) || [],
  };
};

export function getNewAutomationData(
  data: AutomationFormData,
  state: AutomationBuilderState
): NewAutomation {
  const result = {
    name: data.name || 'New Alert',
    triggers: stripDataConditionGroupId(state.triggers),
    environment: data.environment,
    actionFilters: state.actionFilters.map(stripDataConditionGroupId),
    config: {
      frequency: data.frequency ?? undefined,
    },
    detectorIds: data.detectorIds,
    enabled: data.enabled,
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
    enabled: automation.enabled,
    projectIds: [],
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
      errors[actionFilter.id] = t('You must add an action for this alert to run.');
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

/**
 * Subfilter IDs are stripped on form submission, so they need to be re-assigned
 * when loading the edit form for the remove/update logic to work correctly.
 */
export function assignSubfilterIds(
  actionFilters: DataConditionGroup[]
): DataConditionGroup[] {
  return actionFilters.map(assignConditionGroupSubfilterIds);
}

function assignConditionGroupSubfilterIds(group: DataConditionGroup): DataConditionGroup {
  return {
    ...group,
    conditions: group.conditions.map(assignConditionSubfilterIds),
  };
}

function assignConditionSubfilterIds(condition: DataCondition): DataCondition {
  const filters = condition.comparison?.filters;
  if (!filters) {
    return condition;
  }
  return {
    ...condition,
    comparison: {
      ...condition.comparison,
      filters: filters.map(assignSubfilterId),
    },
  };
}

function assignSubfilterId(filter: Subfilter): Subfilter {
  return {
    ...filter,
    id: filter.id ?? uuid4(),
  };
}
