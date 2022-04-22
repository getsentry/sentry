import {useContext} from 'react';

import {
  FlamegraphStateContext,
  FlamegraphStateContextValue,
} from './flamegraphStateProvider';

export function useFlamegraphZoomPositionValue(): FlamegraphStateContextValue[0]['position'] {
  const context = useContext(FlamegraphStateContext);

  if (context === null) {
    throw new Error('useFlamegraphState called outside of FlamegraphStateProvider');
  }

  return context[0].position;
}
