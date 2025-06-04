import {useLayoutEffect} from 'react';

import type {TraceTree} from './traceModels/traceTree';
import type {TraceScheduler} from './traceRenderers/traceScheduler';

// Observer around the tree model that track trace space changes and dispatches
// them to the trace scheduler. This exists because sometimes, the trace space
// changes (tree gets new data, or the precision of events in the tree overflows the current trace duration)
export function useTraceTimelineChangeSync(props: {
  traceScheduler: TraceScheduler;
  tree: TraceTree;
}) {
  useLayoutEffect(() => {
    if (props.tree.type !== 'trace') {
      return undefined;
    }

    props.traceScheduler.dispatch('initialize trace space', [
      props.tree.root.space[0],
      0,
      props.tree.root.space[1],
      1,
    ]);

    // Whenever the timeline changes, update the trace space and trigger a redraw
    const onTraceTimelineChange = (s: [number, number]) => {
      props.traceScheduler.dispatch('set trace space', [s[0], 0, s[1], 1]);
    };

    props.tree.on('trace timeline change', onTraceTimelineChange);

    return () => {
      props.tree.off('trace timeline change', onTraceTimelineChange);
    };
  }, [props.traceScheduler, props.tree]);
}
