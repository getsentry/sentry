import {createContext, type Dispatch, type SetStateAction} from 'react';

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
  setState: Dispatch<SetStateAction<AutomationBuilderState>>;
  state: AutomationBuilderState;
} | null>(null);

export type AutomationBuilderAction =
  | {conditionType: string; type: 'ADD_WHEN_CONDITION'}
  | {index: number; type: 'REMOVE_WHEN_CONDITION'}
  | {comparison: Record<string, any>; index: number; type: 'UPDATE_CONDITION'}
  | {type: 'ADD_IF'}
  | {groupIndex: number; type: 'REMOVE_IF'}
  | {conditionType: string; groupIndex: number; type: 'ADD_IF_CONDITION'}
  | {conditionIndex: number; groupIndex: number; type: 'REMOVE_IF_CONDITION'}
  | {
      comparison: Record<string, any>;
      conditionIndex: number;
      groupIndex: number;
      type: 'UPDATE_IF_CONDITION';
    }
  | {
      groupIndex: number;
      logicType: DataConditionGroupLogicType;
      type: 'UPDATE_IF_LOGIC_TYPE';
    };

export function automationReducer(
  state: AutomationBuilderState,
  action: AutomationBuilderAction,
  formModel?: FormModel
): AutomationBuilderState {
  switch (action.type) {
    case 'ADD_WHEN_CONDITION':
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

    case 'REMOVE_WHEN_CONDITION': {
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

    case 'UPDATE_CONDITION':
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

    case 'ADD_IF':
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

    case 'REMOVE_IF': {
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

    case 'ADD_IF_CONDITION': {
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

    case 'REMOVE_IF_CONDITION': {
      const {groupIndex, conditionIndex} = action;
      if (formModel) {
        for (const key of formModel.fields.keys()) {
          if (
            key.startsWith(`actionFilters.${groupIndex}.conditions.${conditionIndex}.`)
          ) {
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

    case 'UPDATE_IF_CONDITION': {
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
              j === conditionIndex
                ? {...c, comparison: {...c.comparison, ...comparison}}
                : c
            ),
          };
        }),
      };
    }

    case 'UPDATE_IF_LOGIC_TYPE': {
      const {groupIndex, logicType} = action;
      return {
        ...state,
        actionFilters: state.actionFilters.map((group, i) =>
          i === groupIndex ? {...group, logicType} : group
        ),
      };
    }

    default:
      return state;
  }
}
