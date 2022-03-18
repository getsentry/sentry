import {useContext} from 'react';

import {
  FlamegraphState,
  FlamegraphStateAction,
  FlamegraphStateContext,
} from './flamegraphStateProvider';

export function useFlamegraphState(): [
  FlamegraphState,
  React.Dispatch<FlamegraphStateAction>
] {
  const context = useContext(FlamegraphStateContext);

  if (context === null) {
    throw new Error('useFlamegraphState called outside of flamegraphStateProvider');
  }

  return context;
}

export function useFlamegraphStateValue(): FlamegraphState {
  const context = useContext(FlamegraphStateContext);

  if (context === null) {
    throw new Error('useFlamegraphState called outside of flamegraphStateProvider');
  }

  return context[0];
}
