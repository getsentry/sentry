import {createContext, type Reducer, useCallback, useContext, useReducer} from 'react';

import type FormModel from 'sentry/components/forms/model';
import {
  type DataConditionGroup,
  DataConditionGroupLogicType,
  type DataConditionType,
} from 'sentry/types/workflowEngine/dataConditions';

export function useAutomationBuilderReducer() {
  const reducer: Reducer<AutomationBuilderState, AutomationBuilderAction> = useCallback(
    (state, action, formModel?: FormModel): AutomationBuilderState => {
      switch (action.type) {
        case 'ADD_WHEN_CONDITION':
          return addWhenCondition(state, action);
        case 'REMOVE_WHEN_CONDITION':
          return removeWhenCondition(state, action, formModel);
        case 'UPDATE_WHEN_CONDITION':
          return updateWhenCondition(state, action);
        case 'UPDATE_WHEN_LOGIC_TYPE':
          return updateWhenLogicType(state, action);
        case 'ADD_IF':
          return addIf(state, action);
        case 'REMOVE_IF':
          return removeIf(state, action, formModel);
        case 'ADD_IF_CONDITION':
          return addIfCondition(state, action);
        case 'REMOVE_IF_CONDITION':
          return removeIfCondition(state, action, formModel);
        case 'UPDATE_IF_CONDITION':
          return updateIfCondition(state, action);
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
      (index: number) => dispatch({type: 'REMOVE_WHEN_CONDITION', index}),
      [dispatch]
    ),
    updateWhenCondition: useCallback(
      (index: number, comparison: Record<string, any>) =>
        dispatch({type: 'UPDATE_WHEN_CONDITION', index, comparison}),
      [dispatch]
    ),
    updateWhenLogicType: useCallback(
      (logicType: DataConditionGroupLogicType) =>
        dispatch({type: 'UPDATE_WHEN_LOGIC_TYPE', logicType}),
      [dispatch]
    ),
    addIf: useCallback(() => dispatch({type: 'ADD_IF'}), [dispatch]),
    removeIf: useCallback(
      (groupIndex: number) => dispatch({type: 'REMOVE_IF', groupIndex}),
      [dispatch]
    ),
    addIfCondition: useCallback(
      (groupIndex: number, conditionType: DataConditionType) =>
        dispatch({type: 'ADD_IF_CONDITION', groupIndex, conditionType}),
      [dispatch]
    ),
    removeIfCondition: useCallback(
      (groupIndex: number, conditionIndex: number) =>
        dispatch({type: 'REMOVE_IF_CONDITION', groupIndex, conditionIndex}),
      [dispatch]
    ),
    updateIfCondition: useCallback(
      (groupIndex: number, conditionIndex: number, comparison: Record<string, any>) =>
        dispatch({type: 'UPDATE_IF_CONDITION', groupIndex, conditionIndex, comparison}),
      [dispatch]
    ),
    updateIfLogicType: useCallback(
      (groupIndex: number, logicType: DataConditionGroupLogicType) =>
        dispatch({type: 'UPDATE_IF_LOGIC_TYPE', groupIndex, logicType}),
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
export interface AutomationActions {
  addIf: () => void;
  addIfCondition: (groupIndex: number, conditionType: DataConditionType) => void;
  addWhenCondition: (conditionType: DataConditionType) => void;
  removeIf: (groupIndex: number) => void;
  removeIfCondition: (groupIndex: number, conditionIndex: number) => void;
  removeWhenCondition: (index: number) => void;
  updateIfCondition: (
    groupIndex: number,
    conditionIndex: number,
    comparison: Record<string, any>
  ) => void;
  updateIfLogicType: (groupIndex: number, logicType: DataConditionGroupLogicType) => void;
  updateWhenCondition: (index: number, comparison: Record<string, any>) => void;
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
      id: 'if.0',
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
  index: number;
  type: 'REMOVE_WHEN_CONDITION';
};

type UpdateWhenConditionAction = {
  comparison: Record<string, any>;
  index: number;
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
  groupIndex: number;
  type: 'REMOVE_IF';
};

type AddIfConditionAction = {
  conditionType: DataConditionType;
  groupIndex: number;
  type: 'ADD_IF_CONDITION';
};

type RemoveIfConditionAction = {
  conditionIndex: number;
  groupIndex: number;
  type: 'REMOVE_IF_CONDITION';
};

type UpdateIfConditionAction = {
  comparison: Record<string, any>;
  conditionIndex: number;
  groupIndex: number;
  type: 'UPDATE_IF_CONDITION';
};

type UpdateIfLogicTypeAction = {
  groupIndex: number;
  logicType: DataConditionGroupLogicType;
  type: 'UPDATE_IF_LOGIC_TYPE';
};

export type AutomationBuilderAction =
  | AddWhenConditionAction
  | RemoveWhenConditionAction
  | UpdateWhenConditionAction
  | UpdateWhenLogicTypeAction
  | AddIfAction
  | RemoveIfAction
  | AddIfConditionAction
  | RemoveIfConditionAction
  | UpdateIfConditionAction
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
          comparison_type: action.conditionType,
          comparison: {},
        },
      ],
    },
  };
}

function removeWhenCondition(
  state: AutomationBuilderState,
  action: RemoveWhenConditionAction,
  formModel?: FormModel
): AutomationBuilderState {
  const {index} = action;
  if (formModel) {
    for (const key of formModel.fields.keys()) {
      if (key.startsWith(`triggers.conditions.${index}.`)) {
        formModel.removeField(key);
      }
    }
  }

  return {
    ...state,
    triggers: {
      ...state.triggers,
      conditions: [...state.triggers.conditions.filter((_, i) => i !== index)],
    },
  };
}

function updateWhenCondition(
  state: AutomationBuilderState,
  action: UpdateWhenConditionAction
): AutomationBuilderState {
  return {
    ...state,
    triggers: {
      ...state.triggers,
      conditions: state.triggers.conditions.map((c, i) =>
        i === action.index
          ? {...c, comparison: {...c.comparison, ...action.comparison}}
          : c
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
        id: state.actionFilters.length.toString(),
        conditions: [],
        logicType: DataConditionGroupLogicType.ANY,
      },
    ],
  };
}

function removeIf(
  state: AutomationBuilderState,
  action: RemoveIfAction,
  formModel?: FormModel
): AutomationBuilderState {
  const {groupIndex} = action;
  if (formModel) {
    for (const key of formModel.fields.keys()) {
      if (key.startsWith(`actionFilters.${groupIndex}.`)) {
        formModel.removeField(key);
      }
    }
  }
  return {
    ...state,
    actionFilters: state.actionFilters.filter((_, i) => i !== groupIndex),
  };
}

function addIfCondition(
  state: AutomationBuilderState,
  action: AddIfConditionAction
): AutomationBuilderState {
  const {groupIndex, conditionType} = action;
  return {
    ...state,
    actionFilters: state.actionFilters.map((group, i) => {
      if (i !== groupIndex) {
        return group;
      }
      return {
        ...group,
        conditions: [
          ...group.conditions,
          {
            comparison_type: conditionType,
            comparison: {},
          },
        ],
      };
    }),
  };
}

function removeIfCondition(
  state: AutomationBuilderState,
  action: RemoveIfConditionAction,
  formModel?: FormModel
): AutomationBuilderState {
  const {groupIndex, conditionIndex} = action;
  if (formModel) {
    for (const key of formModel.fields.keys()) {
      if (key.startsWith(`actionFilters.${groupIndex}.conditions.${conditionIndex}.`)) {
        formModel.removeField(key);
      }
    }
  }
  return {
    ...state,
    actionFilters: state.actionFilters.map((group, i) => {
      if (i !== groupIndex) {
        return group;
      }
      return {
        ...group,
        conditions: group.conditions.filter((_, j) => j !== conditionIndex),
      };
    }),
  };
}

function updateIfCondition(
  state: AutomationBuilderState,
  action: UpdateIfConditionAction
): AutomationBuilderState {
  const {groupIndex, conditionIndex, comparison} = action;
  return {
    ...state,
    actionFilters: state.actionFilters.map((group, i) => {
      if (i !== groupIndex) {
        return group;
      }
      return {
        ...group,
        conditions: group.conditions.map((c, j) =>
          j === conditionIndex ? {...c, comparison: {...c.comparison, ...comparison}} : c
        ),
      };
    }),
  };
}

function updateIfLogicType(
  state: AutomationBuilderState,
  action: UpdateIfLogicTypeAction
): AutomationBuilderState {
  const {groupIndex, logicType} = action;
  return {
    ...state,
    actionFilters: state.actionFilters.map((group, i) =>
      i === groupIndex ? {...group, logicType} : group
    ),
  };
}
