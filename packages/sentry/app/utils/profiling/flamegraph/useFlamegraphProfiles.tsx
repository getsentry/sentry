import {useContext} from 'react';

import {
  FlamegraphStateContext,
  FlamegraphStateContextValue,
} from './flamegraphStateProvider/index';

export function useFlamegraphProfiles(): [
  FlamegraphStateContextValue[0]['profiles'],
  FlamegraphStateContextValue[1]
] {
  const context = useContext(FlamegraphStateContext);

  if (context === null) {
    throw new Error('useFlamegraphProfiles called outside of FlamegraphStateProvider');
  }

  return [context[0].profiles, context[1]];
}

export function useFlamegraphProfilesValue(): FlamegraphStateContextValue[0]['profiles'] {
  const context = useContext(FlamegraphStateContext);

  if (context === null) {
    throw new Error('useFlamegraphProfiles called outside of FlamegraphStateProvider');
  }

  return context[0].profiles;
}
