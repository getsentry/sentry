import {createContext, useCallback, useContext, useReducer, type Reducer} from 'react';
import {uuid4} from '@sentry/core';

import type {
  Action,
  ActionConfig,
  ActionHandler,
} from 'sentry/types/workflowEngine/actions';
import {
  ActionTarget,
  ActionType,
  SentryAppIdentifier,
} from 'sentry/types/workflowEngine/actions';
import {
  DataConditionGroupLogicType,
  DataConditionType,
  type DataCondition,
  type DataConditionGroup,
} from 'sentry/types/workflowEngine/dataConditions';
import {actionNodesMap} from 'sentry/views/automations/components/actionNodes';
import {dataConditionNodesMap} from 'sentry/views/automations/components/dataConditionNodes';

export function useAutomationBuilderReducer(initialState?: AutomationBuilderState) {
  const reducer: Reducer<AutomationBuilderState, AutomationBuilderAction> = useCallback(
    (state, action): AutomationBuilderState => {
      switch (action.type) {
        case 'ADD_WHEN_CONDITION':
          return addWhenCondition(state, action);
        case 'REMOVE_WHEN_CONDITION':
          return removeWhenCondition(state, action);
        case 'UPDATE_WHEN_CONDITION':
          return updateWhenCondition(state, action);
        case 'UPDATE_WHEN_LOGIC_TYPE':
          return updateWhenLogicType(state, action);
        case 'ADD_IF':
          return addIf(state, action);
        case 'REMOVE_IF':
          return removeIf(state, action);
        case 'ADD_IF_CONDITION':
          return addIfCondition(state, action);
        case 'REMOVE_IF_CONDITION':
          return removeIfCondition(state, action);
        case 'UPDATE_IF_CONDITION':
          return updateIfCondition(state, action);
        case 'ADD_IF_ACTION':
          return addIfAction(state, action);
        case 'REMOVE_IF_ACTION':
          return removeIfAction(state, action);
        case 'UPDATE_IF_ACTION':
          return updateIfAction(state, action);
        case 'UPDATE_IF_LOGIC_TYPE':
          return updateIfLogicType(state, action);
        default:
          return state;
      }
    },
    []
  );

  const [state, dispatch] = useReducer(
    reducer,
    initialState ?? initialAutomationBuilderState
  );

  const actions: AutomationActions = {
    addWhenCondition: useCallback(
      (conditionType: DataConditionType) =>
        dispatch({type: 'ADD_WHEN_CONDITION', conditionType}),
      [dispatch]
    ),
    removeWhenCondition: useCallback(
      (id: string) => dispatch({type: 'REMOVE_WHEN_CONDITION', id}),
      [dispatch]
    ),
    updateWhenCondition: useCallback(
      (
        id: string,
        params: {
          comparison?: any;
          type?: DataConditionType;
        }
      ) => dispatch({type: 'UPDATE_WHEN_CONDITION', id, params}),
      [dispatch]
    ),
    updateWhenLogicType: useCallback(
      (logicType: DataConditionGroupLogicType) =>
        dispatch({type: 'UPDATE_WHEN_LOGIC_TYPE', logicType}),
      [dispatch]
    ),
    addIf: useCallback(() => dispatch({type: 'ADD_IF'}), [dispatch]),
    removeIf: useCallback(
      (groupId: string) => dispatch({type: 'REMOVE_IF', groupId}),
      [dispatch]
    ),
    addIfCondition: useCallback(
      (groupId: string, conditionType: DataConditionType) =>
        dispatch({type: 'ADD_IF_CONDITION', groupId, conditionType}),
      [dispatch]
    ),
    removeIfCondition: useCallback(
      (groupId: string, conditionId: string) =>
        dispatch({type: 'REMOVE_IF_CONDITION', groupId, conditionId}),
      [dispatch]
    ),
    updateIfCondition: useCallback(
      (
        groupId: string,
        conditionId: string,
        params: {comparison?: any; type?: DataConditionType}
      ) => dispatch({type: 'UPDATE_IF_CONDITION', groupId, conditionId, params}),
      [dispatch]
    ),
    addIfAction: useCallback(
      (groupId: string, actionHandler: ActionHandler) =>
        dispatch({type: 'ADD_IF_ACTION', groupId, actionHandler}),
      [dispatch]
    ),
    removeIfAction: useCallback(
      (groupId: string, actionId: string) =>
        dispatch({type: 'REMOVE_IF_ACTION', groupId, actionId}),
      [dispatch]
    ),
    updateIfAction: useCallback(
      (groupId: string, actionId: string, params: Partial<Omit<Action, 'id' | 'type'>>) =>
        dispatch({type: 'UPDATE_IF_ACTION', groupId, actionId, params}),
      [dispatch]
    ),
    updateIfLogicType: useCallback(
      (groupId: string, logicType: DataConditionGroupLogicType) =>
        dispatch({type: 'UPDATE_IF_LOGIC_TYPE', groupId, logicType}),
      [dispatch]
    ),
  };

  return {state, actions};
}

export interface AutomationBuilderState {
  actionFilters: DataConditionGroup[];
  triggers: DataConditionGroup;
}

// The action types and interfaces below need to be manually kept in sync.
// Any changes to action types must be reflected in both:
// 1. The individual action type definitions
// 2. The AutomationActions interface
interface AutomationActions {
  addIf: () => void;
  addIfAction: (groupId: string, actionHandler: ActionHandler) => void;
  addIfCondition: (groupId: string, conditionType: DataConditionType) => void;
  addWhenCondition: (conditionType: DataConditionType) => void;
  removeIf: (groupId: string) => void;
  removeIfAction: (groupId: string, actionId: string) => void;
  removeIfCondition: (groupId: string, conditionId: string) => void;
  removeWhenCondition: (id: string) => void;
  updateIfAction: (
    groupId: string,
    actionId: string,
    params: Partial<Omit<Action, 'id' | 'type'>>
  ) => void;
  updateIfCondition: (
    groupId: string,
    conditionId: string,
    comparison: Record<string, any>
  ) => void;
  updateIfLogicType: (groupId: string, logicType: DataConditionGroupLogicType) => void;
  updateWhenCondition: (id: string, comparison: Record<string, any>) => void;
  updateWhenLogicType: (logicType: DataConditionGroupLogicType) => void;
}

export const AutomationBuilderContext = createContext<{
  actions: AutomationActions;
  // Selector is only shown for existing automations with the "All" logic type
  showTriggerLogicTypeSelector: boolean;
  state: AutomationBuilderState;
} | null>(null);

export const useAutomationBuilderContext = () => {
  const context = useContext(AutomationBuilderContext);
  if (!context) {
    throw new Error(
      'useAutomationBuilderContext was called outside of AutomationBuilder'
    );
  }
  return context;
};

const initialAutomationBuilderState: AutomationBuilderState = {
  triggers: {
    id: 'when',
    logicType: DataConditionGroupLogicType.ANY_SHORT_CIRCUIT,
    conditions: [
      createWhenCondition(DataConditionType.FIRST_SEEN_EVENT),
      createWhenCondition(DataConditionType.REAPPEARED_EVENT),
      createWhenCondition(DataConditionType.REGRESSION_EVENT),
    ],
  },
  actionFilters: [
    {
      id: '0',
      logicType: DataConditionGroupLogicType.ANY_SHORT_CIRCUIT,
      conditions: [],
      actions: [],
    },
  ],
};

type AddWhenConditionAction = {
  conditionType: DataConditionType;
  type: 'ADD_WHEN_CONDITION';
};

type RemoveWhenConditionAction = {
  id: string;
  type: 'REMOVE_WHEN_CONDITION';
};

type UpdateWhenConditionAction = {
  id: string;
  params: {
    comparison?: any;
    type?: DataConditionType;
  };
  type: 'UPDATE_WHEN_CONDITION';
};

type UpdateWhenLogicTypeAction = {
  logicType: DataConditionGroupLogicType;
  type: 'UPDATE_WHEN_LOGIC_TYPE';
};

type AddIfAction = {
  type: 'ADD_IF';
};

type RemoveIfAction = {
  groupId: string;
  type: 'REMOVE_IF';
};

type AddIfConditionAction = {
  conditionType: DataConditionType;
  groupId: string;
  type: 'ADD_IF_CONDITION';
};

type RemoveIfConditionAction = {
  conditionId: string;
  groupId: string;
  type: 'REMOVE_IF_CONDITION';
};

type UpdateIfConditionAction = {
  conditionId: string;
  groupId: string;
  params: {
    comparison?: any;
    type?: DataConditionType;
  };
  type: 'UPDATE_IF_CONDITION';
};

type AddIfActionAction = {
  actionHandler: ActionHandler;
  groupId: string;
  type: 'ADD_IF_ACTION';
};

type RemoveIfActionAction = {
  actionId: string;
  groupId: string;
  type: 'REMOVE_IF_ACTION';
};

type UpdateIfActionAction = {
  actionId: string;
  groupId: string;
  params: Partial<Omit<Action, 'id' | 'type'>>;
  type: 'UPDATE_IF_ACTION';
};

type UpdateIfLogicTypeAction = {
  groupId: string;
  logicType: DataConditionGroupLogicType;
  type: 'UPDATE_IF_LOGIC_TYPE';
};

type AutomationBuilderAction =
  | AddWhenConditionAction
  | RemoveWhenConditionAction
  | UpdateWhenConditionAction
  | UpdateWhenLogicTypeAction
  | AddIfAction
  | RemoveIfAction
  | AddIfConditionAction
  | RemoveIfConditionAction
  | UpdateIfConditionAction
  | AddIfActionAction
  | RemoveIfActionAction
  | UpdateIfActionAction
  | UpdateIfLogicTypeAction;

function createWhenCondition(conditionType: DataConditionType): DataCondition {
  return {
    id: uuid4(),
    type: conditionType,
    comparison: true,
    conditionResult: true,
  };
}

function addWhenCondition(
  state: AutomationBuilderState,
  action: AddWhenConditionAction
): AutomationBuilderState {
  return {
    ...state,
    triggers: {
      ...state.triggers,
      conditions: [
        ...state.triggers.conditions,
        createWhenCondition(action.conditionType),
      ],
    },
  };
}

function removeWhenCondition(
  state: AutomationBuilderState,
  action: RemoveWhenConditionAction
): AutomationBuilderState {
  const {id} = action;
  return {
    ...state,
    triggers: {
      ...state.triggers,
      conditions: [...state.triggers.conditions.filter(c => c.id !== id)],
    },
  };
}

function updateWhenCondition(
  state: AutomationBuilderState,
  action: UpdateWhenConditionAction
): AutomationBuilderState {
  const {id, params} = action;
  const {comparison, type} = params;
  return {
    ...state,
    triggers: {
      ...state.triggers,
      conditions: state.triggers.conditions.map(c =>
        c.id === id ? {...c, ...(comparison && {comparison}), ...(type && {type})} : c
      ),
    },
  };
}

function updateWhenLogicType(
  state: AutomationBuilderState,
  action: UpdateWhenLogicTypeAction
): AutomationBuilderState {
  const {logicType} = action;
  return {
    ...state,
    triggers: {
      ...state.triggers,
      logicType,
    },
  };
}

function addIf(
  state: AutomationBuilderState,
  _action: AddIfAction
): AutomationBuilderState {
  return {
    ...state,
    actionFilters: [
      ...state.actionFilters,
      {
        id: uuid4(),
        conditions: [],
        actions: [],
        logicType: DataConditionGroupLogicType.ALL,
      },
    ],
  };
}

function removeIf(
  state: AutomationBuilderState,
  action: RemoveIfAction
): AutomationBuilderState {
  const {groupId} = action;
  return {
    ...state,
    actionFilters: state.actionFilters.filter(group => group.id !== groupId),
  };
}

function addIfCondition(
  state: AutomationBuilderState,
  action: AddIfConditionAction
): AutomationBuilderState {
  const {groupId, conditionType} = action;
  return {
    ...state,
    actionFilters: state.actionFilters.map(group => {
      if (group.id !== groupId) {
        return group;
      }
      return {
        ...group,
        conditions: [
          ...group.conditions,
          {
            id: uuid4(),
            type: conditionType,
            comparison:
              dataConditionNodesMap.get(conditionType)?.defaultComparison || true,
            conditionResult: true,
          },
        ],
      };
    }),
  };
}

function removeIfCondition(
  state: AutomationBuilderState,
  action: RemoveIfConditionAction
): AutomationBuilderState {
  const {groupId, conditionId} = action;
  return {
    ...state,
    actionFilters: state.actionFilters.map(group => {
      if (group.id !== groupId) {
        return group;
      }
      return {
        ...group,
        conditions: group.conditions.filter(c => c.id !== conditionId),
      };
    }),
  };
}

function updateIfCondition(
  state: AutomationBuilderState,
  action: UpdateIfConditionAction
): AutomationBuilderState {
  const {groupId, conditionId, params} = action;
  const {comparison, type} = params;
  return {
    ...state,
    actionFilters: state.actionFilters.map(group => {
      if (group.id !== groupId) {
        return group;
      }
      return {
        ...group,
        conditions: group.conditions.map(c =>
          c.id === conditionId
            ? {...c, ...(comparison && {comparison}), ...(type && {type})}
            : c
        ),
      };
    }),
  };
}

function getActionTargetType(actionType: ActionType): ActionTarget | null {
  switch (actionType) {
    case ActionType.PLUGIN:
      return null;
    case ActionType.EMAIL:
      return ActionTarget.ISSUE_OWNERS;
    case ActionType.SENTRY_APP:
      return ActionTarget.SENTRY_APP;
    default:
      return ActionTarget.SPECIFIC;
  }
}

function getDefaultConfig(actionHandler: ActionHandler): ActionConfig {
  const targetType = getActionTargetType(actionHandler.type);
  const targetIdentifier =
    actionHandler.sentryApp?.id ??
    actionHandler.integrations?.[0]?.services?.[0]?.id ??
    actionHandler.services?.[0]?.slug ??
    null;
  const targetDisplay =
    actionHandler.sentryApp?.name ??
    actionHandler.integrations?.[0]?.services?.[0]?.name ??
    actionHandler.services?.[0]?.name ??
    null;

  return {
    targetType,
    targetIdentifier,
    targetDisplay,
    ...(actionHandler.sentryApp?.id && {
      sentryAppIdentifier: SentryAppIdentifier.SENTRY_APP_ID,
    }),
  };
}

function addIfAction(
  state: AutomationBuilderState,
  action: AddIfActionAction
): AutomationBuilderState {
  const {groupId, actionHandler} = action;

  const defaultIntegration = actionHandler.integrations?.[0];

  return {
    ...state,
    actionFilters: state.actionFilters.map(group => {
      if (group.id !== groupId) {
        return group;
      }
      return {
        ...group,
        actions: [
          ...(group.actions ?? []),
          {
            id: uuid4(),
            type: actionHandler.type,
            config: getDefaultConfig(actionHandler),
            ...(defaultIntegration && {
              integrationId: defaultIntegration.id,
            }),
            data: actionNodesMap.get(actionHandler.type)?.defaultData || {},
            status: 'active',
          },
        ],
      };
    }),
  };
}

function removeIfAction(
  state: AutomationBuilderState,
  action: RemoveIfActionAction
): AutomationBuilderState {
  const {groupId, actionId} = action;
  return {
    ...state,
    actionFilters: state.actionFilters.map(group => {
      if (group.id !== groupId) {
        return group;
      }
      return {
        ...group,
        actions: group.actions?.filter(a => a.id !== actionId),
      };
    }),
  };
}

function updateIfAction(
  state: AutomationBuilderState,
  action: UpdateIfActionAction
): AutomationBuilderState {
  const {groupId, actionId, params} = action;

  return {
    ...state,
    actionFilters: state.actionFilters.map(group => {
      if (group.id !== groupId) {
        return group;
      }
      return {
        ...group,
        actions: group.actions?.map(a =>
          a.id === actionId
            ? {
                ...a,
                ...params,
              }
            : a
        ),
      };
    }),
  };
}

function updateIfLogicType(
  state: AutomationBuilderState,
  action: UpdateIfLogicTypeAction
): AutomationBuilderState {
  const {groupId, logicType} = action;
  return {
    ...state,
    actionFilters: state.actionFilters.map(group =>
      group.id === groupId ? {...group, logicType} : group
    ),
  };
}
