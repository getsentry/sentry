import {useContext} from 'react';

import {
  FlamegraphPreferences,
  FlamegraphPreferencesAction,
  FlamegraphPreferencesContext,
} from './flamegraphPreferencesProvider';

export function useFlamegraphPreferences(): [
  FlamegraphPreferences,
  React.Dispatch<FlamegraphPreferencesAction>
] {
  const context = useContext(FlamegraphPreferencesContext);

  if (context === null) {
    throw new Error(
      'useFlamegraphPreferences called outside of FlamegraphPreferencesProvider'
    );
  }

  return context;
}

export function useFlamegraphPreferencesValue(): FlamegraphPreferences {
  const context = useContext(FlamegraphPreferencesContext);

  if (context === null) {
    throw new Error(
      'useFlamegraphPreferences called outside of FlamegraphPreferencesProvider'
    );
  }

  return context[0];
}
