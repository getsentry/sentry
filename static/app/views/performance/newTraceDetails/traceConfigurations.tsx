import {createContext, useContext} from 'react';

import type {TracePreferencesState} from './traceState/tracePreferences';

export type TracePreferencesConfigurations = {
  defaultPreferenceState: TracePreferencesState;
  localStorageKey: string;
};

type TraceConfigurations = {
  preferences: TracePreferencesConfigurations;
};

export const TraceConfigurationsContext = createContext<TraceConfigurations | undefined>(
  undefined
);

export const useTraceConfigurations = (): TraceConfigurations => {
  const context = useContext(TraceConfigurationsContext);
  if (!context) {
    throw new Error(
      'useTraceConfigurations must be used within a TraceConfigurationsContext.Provider'
    );
  }
  return context;
};
