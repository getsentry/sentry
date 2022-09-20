import {useContext} from 'react';

import {
  FlamegraphStateDispatch,
  FlamegraphStateDispatchContext,
  FlamegraphStateValue,
  FlamegraphStateValueContext,
} from '../flamegraphStateProvider/flamegraphContext';

export function useFlamegraphState(): FlamegraphStateValue {
  const context = useContext(FlamegraphStateValueContext);

  if (context === null) {
    throw new Error('useFlamegraphState called outside of FlamegraphStateProvider');
  }

  return context;
}

export function useDispatchFlamegraphState(): FlamegraphStateDispatch {
  const context = useContext(FlamegraphStateDispatchContext);

  if (context === null) {
    throw new Error('useFlamegraphState called outside of FlamegraphStateProvider');
  }

  return context;
}
