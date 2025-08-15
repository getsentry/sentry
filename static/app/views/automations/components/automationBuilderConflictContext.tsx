import {createContext, useContext} from 'react';

export interface ConflictingConditions {
  conflictReason: string | null;
  conflictingConditionGroups: Record<string, Set<string>>;
}

export const AutomationBuilderConflictContext =
  createContext<ConflictingConditions | null>(null);

export const useAutomationBuilderConflictContext = () => {
  const context = useContext(AutomationBuilderConflictContext);
  if (!context) {
    throw new Error(
      'useAutomationBuilderConflictContext was called outside of AutomationBuilder'
    );
  }
  return context;
};
