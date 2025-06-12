import {useContext} from 'react';

import type {FlamegraphState} from 'sentry/utils/profiling/flamegraph/flamegraphStateProvider/flamegraphContext';
import {FlamegraphStateValueContext} from 'sentry/utils/profiling/flamegraph/flamegraphStateProvider/flamegraphContext';

export function useFlamegraphSearch(): FlamegraphState['search'] {
  const context = useContext(FlamegraphStateValueContext);

  if (context === null) {
    throw new Error('useFlamegraphSearch called outside of FlamegraphStateProvider');
  }

  return context[0].search;
}
