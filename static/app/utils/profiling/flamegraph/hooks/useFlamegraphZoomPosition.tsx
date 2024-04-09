import {useContext} from 'react';

import type {FlamegraphState} from '../flamegraphStateProvider/flamegraphContext';
import {FlamegraphStateValueContext} from '../flamegraphStateProvider/flamegraphContext';

export function useFlamegraphZoomPosition(): FlamegraphState['position'] {
  const context = useContext(FlamegraphStateValueContext);

  if (context === null) {
    throw new Error('useFlamegraphState called outside of FlamegraphStateProvider');
  }

  return context[0].position;
}
