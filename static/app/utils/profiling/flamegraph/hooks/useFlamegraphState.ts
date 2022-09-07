import {useContext} from 'react';

import {
  FlamegraphState,
  FlamegraphStateDispatch,
  FlamegraphStateDispatchContext,
  FlamegraphStateValueContext,
} from '../flamegraphStateProvider/flamegraphContext';

export function useFlamegraphState(): FlamegraphState {
  const context = useContext(FlamegraphStateValueContext);

  if (context === null) {
    throw new Error('useFlamegraphState called outside of FlamegraphStateProvider');
  }

  return context[0];
}

export function useDispatchFlamegraphState(): FlamegraphStateDispatch {
  const context = useContext(FlamegraphStateDispatchContext);

  if (context === null) {
    throw new Error('useFlamegraphState called outside of FlamegraphStateProvider');
  }

  return context;
}
