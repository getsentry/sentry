import {useContext} from 'react';

import {
  FlamegraphStateContext,
  FlamegraphStateContextValue,
} from './flamegraphStateProvider';

export function useFlamegraphPreferences(): [
  FlamegraphStateContextValue[0]['preferences'],
  FlamegraphStateContextValue[1]
] {
  const context = useContext(FlamegraphStateContext);

  if (context === null) {
    throw new Error('useFlamegraphPreferences called outside of FlamegraphStateProvider');
  }

  return [context[0].preferences, context[1]];
}

export function useFlamegraphPreferencesValue(): FlamegraphStateContextValue[0]['preferences'] {
  const context = useContext(FlamegraphStateContext);

  if (context === null) {
    throw new Error('useFlamegraphPreferences called outside of FlamegraphStateProvider');
  }

  return context[0].preferences;
}
