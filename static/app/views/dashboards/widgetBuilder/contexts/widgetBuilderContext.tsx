import type React from 'react';
import {createContext, useContext} from 'react';

import useWidgetBuilderState from '../hooks/useWidgetBuilderState';

const WidgetBuilderContext = createContext<
  ReturnType<typeof useWidgetBuilderState> | undefined
>(undefined);

interface WidgetBuilderProviderProps {
  children: React.ReactNode;
}

/**
 * Provider for maintaining a single source of truth for the widget builder state.
 */
export function WidgetBuilderProvider({children}: WidgetBuilderProviderProps) {
  const widgetBuilderState = useWidgetBuilderState();
  return (
    <WidgetBuilderContext.Provider value={widgetBuilderState}>
      {children}
    </WidgetBuilderContext.Provider>
  );
}

/**
 * Custom hook to get state and dispatch from the WidgetBuilderContext
 */
export const useWidgetBuilderContext = () => {
  const context = useContext(WidgetBuilderContext);
  if (!context) {
    throw new Error(
      'useWidgetBuilderContext must be used within a WidgetBuilderProvider'
    );
  }
  return context;
};
