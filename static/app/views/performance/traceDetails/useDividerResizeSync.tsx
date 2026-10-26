import {useLayoutEffect} from 'react';

import type {TraceScheduler} from './traceRenderers/traceScheduler';
import {useTraceStateDispatch} from './traceState/traceStateProvider';

// Observer around the divider resize event. This exists because we dont want to
// dispatch a trace action for every single divider resize event (mousemove), and
// instead only want to dispatch it when the resizing is done.
export function useDividerResizeSync(traceScheduler: TraceScheduler) {
  const traceDispatch = useTraceStateDispatch();

  useLayoutEffect(() => {
    function onDividerResizeEnd(list_width: number) {
      traceDispatch({
        type: 'set list width',
        payload: list_width,
      });
    }
    traceScheduler.on('divider resize end', onDividerResizeEnd);
    return () => {
      traceScheduler.off('divider resize end', onDividerResizeEnd);
    };
  }, [traceScheduler, traceDispatch]);
}
