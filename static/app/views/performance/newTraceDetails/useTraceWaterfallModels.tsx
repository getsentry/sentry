import {useMemo} from 'react';
import {useTheme} from '@emotion/react';

import {useTraceState} from 'sentry/views/performance/newTraceDetails/traceState/traceStateProvider';

import {TraceScheduler} from './traceRenderers/traceScheduler';
import {TraceView} from './traceRenderers/traceView';
import {VirtualizedViewManager} from './traceRenderers/virtualizedViewManager';

export function useTraceWaterfallModels() {
  const theme = useTheme();
  const traceState = useTraceState();
  const traceView = useMemo(() => new TraceView(), []);
  const traceScheduler = useMemo(() => new TraceScheduler(), []);

  const viewManager = useMemo(() => {
    return new VirtualizedViewManager(
      {
        list: {width: traceState.preferences.list.width},
        span_list: {width: 1 - traceState.preferences.list.width},
      },
      traceScheduler,
      traceView,
      theme
    );
    // We only care about initial state when we initialize the view manager
    // but we need to stay reactive to theme changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [theme]);

  return {traceView, traceScheduler, viewManager};
}
