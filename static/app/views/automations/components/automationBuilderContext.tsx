import {createContext, type Reducer, useCallback, useContext, useReducer} from 'react';
import {uuid4} from '@sentry/core';

import {
  type ActionHandler,
  ActionTarget,
  ActionType,
} from 'sentry/types/workflowEngine/actions';
import {
  type DataConditionGroup,
  DataConditionGroupLogicType,
  type DataConditionType,
} from 'sentry/types/workflowEngine/dataConditions';

export function useAutomationBuilderReducer() {
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
        case 'UPDATE_IF_CONDITION_TYPE':
          return updateIfConditionType(state, action);
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

  const [state, dispatch] = useReducer(reducer, initialAutomationBuilderState);

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
      (id: string, comparison: Record<string, any>) =>
        dispatch({type: 'UPDATE_WHEN_CONDITION', id, comparison}),
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
    updateIfConditionType: useCallback(
      (groupId: string, conditionId: string, conditionType: DataConditionType) =>
        dispatch({
          type: 'UPDATE_IF_CONDITION_TYPE',
          groupId,
          conditionId,
          conditionType,
        }),
      [dispatch]
    ),
    updateIfCondition: useCallback(
      (groupId: string, conditionId: string, comparison: Record<string, any>) =>
        dispatch({type: 'UPDATE_IF_CONDITION', groupId, conditionId, comparison}),
      [dispatch]
    ),
    addIfAction: useCallback(
      (groupId: string, actionId: string, actionHandler: ActionHandler) =>
        dispatch({type: 'ADD_IF_ACTION', groupId, actionId, actionHandler}),
      [dispatch]
    ),
    removeIfAction: useCallback(
      (groupId: string, actionId: string) =>
        dispatch({type: 'REMOVE_IF_ACTION', groupId, actionId}),
      [dispatch]
    ),
    updateIfAction: useCallback(
      (
        groupId: string,
        actionId: string,
        params: {
          config?: Record<string, any>;
          data?: Record<string, any>;
          integrationId?: string;
        }
      ) => dispatch({type: 'UPDATE_IF_ACTION', groupId, actionId, params}),
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
  addIfAction: (groupId: string, actionId: string, actionHandler: ActionHandler) => void;
  addIfCondition: (groupId: string, conditionType: DataConditionType) => void;
  addWhenCondition: (conditionType: DataConditionType) => void;
  removeIf: (groupId: string) => void;
  removeIfAction: (groupId: string, actionId: string) => void;
  removeIfCondition: (groupId: string, conditionId: string) => void;
  removeWhenCondition: (id: string) => void;
  updateIfAction: (
    groupId: string,
    actionId: string,
    params: {
      config?: Record<string, any>;
      data?: Record<string, any>;
      integrationId?: string;
    }
  ) => void;
  updateIfCondition: (
    groupId: string,
    conditionId: string,
    comparison: Record<string, any>
  ) => void;
  updateIfConditionType: (
    groupId: string,
    conditionId: string,
    conditionType: DataConditionType
  ) => void;
  updateIfLogicType: (groupId: string, logicType: DataConditionGroupLogicType) => void;
  updateWhenCondition: (id: string, comparison: Record<string, any>) => void;
  updateWhenLogicType: (logicType: DataConditionGroupLogicType) => void;
}

export const AutomationBuilderContext = createContext<{
  actions: AutomationActions;
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

export const initialAutomationBuilderState: AutomationBuilderState = {
  triggers: {
    id: 'when',
    logicType: DataConditionGroupLogicType.ANY_SHORT_CIRCUIT,
    conditions: [],
  },
  actionFilters: [
    {
      id: '0',
      logicType: DataConditionGroupLogicType.ANY_SHORT_CIRCUIT,
      conditions: [],
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
  comparison: Record<string, any>;
  id: string;
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

type UpdateIfConditionTypeAction = {
  conditionId: string;
  conditionType: DataConditionType;
  groupId: string;
  type: 'UPDATE_IF_CONDITION_TYPE';
};

type UpdateIfConditionAction = {
  comparison: Record<string, any>;
  conditionId: string;
  groupId: string;
  type: 'UPDATE_IF_CONDITION';
};

type AddIfActionAction = {
  actionHandler: ActionHandler;
  actionId: string;
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
  params: {
    config?: Record<string, any>;
    data?: Record<string, any>;
    integrationId?: string;
  };
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
  | UpdateIfConditionTypeAction
  | UpdateIfConditionAction
  | AddIfActionAction
  | RemoveIfActionAction
  | UpdateIfActionAction
  | UpdateIfLogicTypeAction;

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
        {
          id: uuid4(),
          type: action.conditionType,
          comparison: true,
          conditionResult: true,
        },
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
  const {id, comparison} = action;
  return {
    ...state,
    triggers: {
      ...state.triggers,
      conditions: state.triggers.conditions.map(c =>
        c.id === id ? {...c, comparison: {...c.comparison, ...comparison}} : c
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
        logicType: DataConditionGroupLogicType.ANY,
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
            comparison: true,
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

function updateIfConditionType(
  state: AutomationBuilderState,
  action: UpdateIfConditionTypeAction
): AutomationBuilderState {
  const {groupId, conditionId, conditionType} = action;
  return {
    ...state,
    actionFilters: state.actionFilters.map(group => {
      if (group.id !== groupId) {
        return group;
      }
      return {
        ...group,
        conditions: group.conditions.map(c =>
          c.id === conditionId ? {...c, type: conditionType} : c
        ),
      };
    }),
  };
}

function updateIfCondition(
  state: AutomationBuilderState,
  action: UpdateIfConditionAction
): AutomationBuilderState {
  const {groupId, conditionId, comparison} = action;
  return {
    ...state,
    actionFilters: state.actionFilters.map(group => {
      if (group.id !== groupId) {
        return group;
      }
      return {
        ...group,
        conditions: group.conditions.map(c =>
          c.id === conditionId ? {...c, comparison: {...c.comparison, ...comparison}} : c
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

function addIfAction(
  state: AutomationBuilderState,
  action: AddIfActionAction
): AutomationBuilderState {
  const {groupId, actionId, actionHandler} = action;

  const targetType = getActionTargetType(actionHandler.type);

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
            id: actionId,
            type: actionHandler.type,
            config: {
              target_type: targetType,
              ...(actionHandler.sentryApp
                ? {target_identifier: actionHandler.sentryApp.id}
                : {}),
            },
            data: {},
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
  const {integrationId, config, data} = params;

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
                ...(integrationId && {integrationId}),
                ...(config && {config: {...a.config, ...config}}),
                ...(data && {data: {...a.data, ...data}}),
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
