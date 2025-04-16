import {
  createContext,
  type Dispatch,
  type Reducer,
  useCallback,
  useContext,
  useReducer,
} from 'react';

import type FormModel from 'sentry/components/forms/model';
import {
  type DataConditionGroup,
  DataConditionGroupLogicType,
  type DataConditionType,
} from 'sentry/types/workflowEngine/dataConditions';

export interface AutomationBuilderState {
  actionFilters: DataConditionGroup[];
  triggers: DataConditionGroup;
}

export const AutomationBuilderContext = createContext<{
  dispatch: Dispatch<AutomationBuilderAction>;
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

export const initialState: AutomationBuilderState = {
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
  conditionType: string;
  type: 'ADD_WHEN_CONDITION';
};

type RemoveWhenConditionAction = {
  index: number;
  type: 'REMOVE_WHEN_CONDITION';
};

type UpdateConditionAction = {
  comparison: Record<string, any>;
  index: number;
  type: 'UPDATE_CONDITION';
};

type AddIfAction = {
  type: 'ADD_IF';
};

type RemoveIfAction = {
  groupIndex: number;
  type: 'REMOVE_IF';
};

type AddIfConditionAction = {
  conditionType: string;
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

type UpdateWhenLogicTypeAction = {
  logicType: DataConditionGroupLogicType;
  type: 'UPDATE_WHEN_LOGIC_TYPE';
};

export type AutomationBuilderAction =
  | AddWhenConditionAction
  | RemoveWhenConditionAction
  | UpdateConditionAction
  | AddIfAction
  | RemoveIfAction
  | AddIfConditionAction
  | RemoveIfConditionAction
  | UpdateIfConditionAction
  | UpdateIfLogicTypeAction
  | UpdateWhenLogicTypeAction;

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
          comparison_type: action.conditionType as DataConditionType,
          comparison: {},
          condition_result: undefined,
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

function updateCondition(
  state: AutomationBuilderState,
  action: UpdateConditionAction
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
            comparison_type: conditionType as DataConditionType,
            comparison: {},
            condition_result: undefined,
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

export function useAutomationBuilderReducer() {
  const reducer: Reducer<AutomationBuilderState, AutomationBuilderAction> = useCallback(
    (state, action, formModel?: FormModel): AutomationBuilderState => {
      switch (action.type) {
        case 'ADD_WHEN_CONDITION':
          return addWhenCondition(state, action);
        case 'REMOVE_WHEN_CONDITION':
          return removeWhenCondition(state, action, formModel);
        case 'UPDATE_CONDITION':
          return updateCondition(state, action);
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
        case 'UPDATE_WHEN_LOGIC_TYPE':
          return updateWhenLogicType(state, action);
        default:
          return state;
      }
    },
    []
  );

  const [state, dispatch] = useReducer(reducer, initialState);

  return {state, dispatch};
}
