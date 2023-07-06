import {useContext} from 'react';

import {
  FlamegraphState,
  FlamegraphStateValueContext,
} from '../flamegraphStateProvider/flamegraphContext';

export function useFlamegraphProfiles(): FlamegraphState['profiles'] {
  const context = useContext(FlamegraphStateValueContext);

  if (context === null) {
    throw new Error('useFlamegraphProfiles called outside of FlamegraphStateProvider');
  }

  return context[0].profiles;
}
