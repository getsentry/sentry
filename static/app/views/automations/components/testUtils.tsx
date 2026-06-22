import type {ReactNode} from 'react';

import {DataConditionGroupLogicType} from 'sentry/types/workflowEngine/dataConditions';
import {AutomationBuilderConflictContext} from 'sentry/views/automations/components/automationBuilderConflictContext';
import {
  AutomationBuilderContext,
  type AutomationBuilderState,
} from 'sentry/views/automations/components/automationBuilderContext';
import {AutomationBuilderErrorContext} from 'sentry/views/automations/components/automationBuilderErrorContext';

const defaultBuilderState: AutomationBuilderState = {
  triggers: {
    id: 'triggers',
    conditions: [],
    logicType: DataConditionGroupLogicType.ANY,
  },
  actionFilters: [],
};

const defaultBuilderActions = {
  addWhenCondition: jest.fn(),
  removeWhenCondition: jest.fn(),
  updateWhenCondition: jest.fn(),
  updateWhenLogicType: jest.fn(),
  addIf: jest.fn(),
  removeIf: jest.fn(),
  addIfCondition: jest.fn(),
  removeIfCondition: jest.fn(),
  updateIfCondition: jest.fn(),
  updateIfLogicType: jest.fn(),
  addIfAction: jest.fn(),
  removeIfAction: jest.fn(),
  updateIfAction: jest.fn(),
};

interface AutomationBuilderProviderOptions {
  builderState?: Partial<AutomationBuilderState>;
  conflictContext?: {
    conflictReason: string | null;
    conflictingConditionGroups: Record<string, Set<string>>;
  };
  errorContext?: {
    errors: Record<string, any>;
    mutationErrors: any;
    removeError: (errorId: string) => void;
    setErrors: (...args: any[]) => void;
  };
}

export function AutomationBuilderTestProvider({
  children,
  builderState,
  errorContext,
  conflictContext,
}: AutomationBuilderProviderOptions & {children: ReactNode}) {
  return (
    <AutomationBuilderContext.Provider
      value={{
        state: {...defaultBuilderState, ...builderState},
        actions: defaultBuilderActions,
        showTriggerLogicTypeSelector: false,
      }}
    >
      <AutomationBuilderErrorContext.Provider
        value={
          errorContext ?? {
            errors: {},
            mutationErrors: undefined,
            setErrors: jest.fn(),
            removeError: jest.fn(),
          }
        }
      >
        <AutomationBuilderConflictContext.Provider
          value={
            conflictContext ?? {
              conflictingConditionGroups: {},
              conflictReason: null,
            }
          }
        >
          {children}
        </AutomationBuilderConflictContext.Provider>
      </AutomationBuilderErrorContext.Provider>
    </AutomationBuilderContext.Provider>
  );
}
