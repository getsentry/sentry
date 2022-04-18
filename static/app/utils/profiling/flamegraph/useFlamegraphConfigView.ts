import {useContext} from 'react';

import {
  FlamegraphStateContext,
  FlamegraphStateContextValue,
} from './flamegraphStateProvider';

export function useFlamegraphConfigView(): [
  FlamegraphStateContextValue[0]['configView'],
  FlamegraphStateContextValue[1]
] {
  const context = useContext(FlamegraphStateContext);

  if (context === null) {
    throw new Error('useFlamegraphConfigView called outside of FlamegraphStateProvider');
  }

  return [context[0].configView, context[1]];
}

export function useFlamegraphConfigViewValue(): FlamegraphStateContextValue[0]['configView'] {
  const context = useContext(FlamegraphStateContext);

  if (context === null) {
    throw new Error(
      'useFlamegraphConfigViewValue called outside of FlamegraphStateProvider'
    );
  }

  return context[0].configView;
}
