import {UserFixture} from 'sentry-fixture/user';

import type {Action} from 'sentry/types/workflowEngine/actions';
import {ActionTarget, ActionType} from 'sentry/types/workflowEngine/actions';
import type {Automation} from 'sentry/types/workflowEngine/automations';
import {
  type DataCondition,
  type DataConditionGroup,
  DataConditionGroupLogicType,
  DataConditionType,
} from 'sentry/types/workflowEngine/dataConditions';
import {MatchType} from 'sentry/views/automations/components/actionFilters/constants';

export function AutomationFixture(params: Partial<Automation> = {}): Automation {
  return {
    id: '1',
    name: 'Automation 1',
    createdBy: UserFixture().id,
    dateCreated: '2025-01-01T00:00:00.000Z',
    dateUpdated: '2025-01-01T00:00:00.000Z',
    lastTriggered: '2025-01-01T00:00:00.000Z',
    config: {},
    disabled: false,
    actionFilters: [ActionFilterFixture()],
    detectorIds: ['1'],
    environment: 'production',
    triggers: {
      conditions: [],
      id: '1',
      logicType: DataConditionGroupLogicType.ANY,
    },
    ...params,
  };
}

function ActionFilterFixture(
  params: Partial<DataConditionGroup> = {}
): DataConditionGroup {
  return {
    id: '1',
    conditions: [DataConditionFixture()],
    actions: [ActionFixture()],
    logicType: DataConditionGroupLogicType.ANY,
    ...params,
  };
}

export function DataConditionFixture(params: Partial<DataCondition> = {}): DataCondition {
  return {
    id: '1',
    type: DataConditionType.TAGGED_EVENT,
    comparison: {
      key: 'name',
      match: MatchType.CONTAINS,
      value: 'moo deng',
    },
    ...params,
  };
}

function ActionFixture(params: Partial<Action> = {}): Action {
  return {
    id: '1000',
    type: ActionType.SLACK,
    config: {
      target_type: ActionTarget.SPECIFIC,
    },
    data: {},
    ...params,
  };
}
