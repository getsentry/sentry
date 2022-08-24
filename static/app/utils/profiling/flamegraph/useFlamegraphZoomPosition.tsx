import {useContext} from 'react';

import type {FlamegraphStateContextValue} from './flamegraphStateProvider';
import {FlamegraphStateContext} from './flamegraphStateProvider';

export function useFlamegraphZoomPositionValue(): FlamegraphStateContextValue[0]['position'] {
  const context = useContext(FlamegraphStateContext);

  if (context === null) {
    throw new Error('useFlamegraphState called outside of FlamegraphStateProvider');
  }

  return context[0].position;
}
