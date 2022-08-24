import {useContext} from 'react';

import type {FlamegraphStateContextValue} from './flamegraphStateProvider';
import {FlamegraphStateContext} from './flamegraphStateProvider';

export function useFlamegraphSearch(): [
  FlamegraphStateContextValue[0]['search'],
  FlamegraphStateContextValue[1]
] {
  const context = useContext(FlamegraphStateContext);

  if (context === null) {
    throw new Error('useFlamegraphSearch called outside of FlamegraphStateProvider');
  }

  return [context[0].search, context[1]];
}

export function useFlamegraphSearchValue(): FlamegraphStateContextValue[0]['search'] {
  const context = useContext(FlamegraphStateContext);

  if (context === null) {
    throw new Error('useFlamegraphSearchValue called outside of FlamegraphStateProvider');
  }

  return context[0].search;
}
