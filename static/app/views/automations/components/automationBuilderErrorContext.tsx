import {createContext, useContext} from 'react';

export const AutomationBuilderErrorContext = createContext<{
  errors: Record<string, string>;
  removeError: (errorId: string) => void;
  setErrors: (errors: Record<string, string>) => void;
} | null>(null);

export const useAutomationBuilderErrorContext = () => {
  const context = useContext(AutomationBuilderErrorContext);
  if (!context) {
    throw new Error(
      'useAutomationBuilderErrorContext was called outside of AutomationBuilder'
    );
  }
  return context;
};
