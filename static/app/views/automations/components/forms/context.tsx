import {createContext, useContext, useState} from 'react';
import type {ReactNode} from 'react';

import type {Automation} from 'sentry/types/workflowEngine/automations';

interface AutomationFormContextValue {
  hasSetAutomationName: boolean;
  setHasSetAutomationName: (value: boolean) => void;
  automation?: Automation;
}

const AutomationFormContext = createContext<AutomationFormContextValue | undefined>(
  undefined
);

interface AutomationFormProviderProps {
  children: ReactNode;
  automation?: Automation;
}

export function AutomationFormProvider({
  children,
  automation,
}: AutomationFormProviderProps) {
  const [hasSetAutomationName, setHasSetAutomationName] = useState(false);

  return (
    <AutomationFormContext.Provider
      value={{
        hasSetAutomationName,
        setHasSetAutomationName,
        automation,
      }}
    >
      {children}
    </AutomationFormContext.Provider>
  );
}

export function useAutomationFormContext(): AutomationFormContextValue {
  const context = useContext(AutomationFormContext);
  if (context === undefined) {
    throw new Error(
      'useAutomationFormContext must be used within an AutomationFormProvider'
    );
  }
  return context;
}
