import {useLayoutEffect} from 'react';

import {
  TraceEventPriority,
  type TraceEvents,
  type TraceScheduler,
} from './traceRenderers/traceScheduler';
import type {TraceView} from './traceRenderers/traceView';
import type {VirtualizedViewManager} from './traceRenderers/virtualizedViewManager';

// Wire up the trace view to listen for events that happen in the trace scheduler.
// This is required because the user interface needs to communicate bidirectionally
// with the trace scheduler and actions can be dispatched from either side.
export function useTraceSpaceListeners(props: {
  traceScheduler: TraceScheduler;
  view: TraceView;
  viewManager: VirtualizedViewManager;
}) {
  useLayoutEffect(() => {
    const onTraceViewChange: TraceEvents['set trace view'] = view => {
      props.view.setTraceView(view);
      props.viewManager.enqueueFOVQueryParamSync(props.view);
    };

    const onPhysicalSpaceChange: TraceEvents['set container physical space'] =
      container => {
        props.view.setTracePhysicalSpace(container, [
          0,
          0,
          container[2] * props.viewManager.columns.span_list.width,
          container[3],
        ]);
      };

    const onTraceSpaceChange: TraceEvents['initialize trace space'] = view => {
      props.view.setTraceSpace(view);
    };

    // These handlers have high priority because they are responsible for
    // updating the view coordinates. If we update them first, then any components downstream
    // that rely on the view coordinates will be in sync with the view.
    props.traceScheduler.on('set trace view', onTraceViewChange, TraceEventPriority.HIGH);
    props.traceScheduler.on(
      'set trace space',
      onTraceSpaceChange,
      TraceEventPriority.HIGH
    );
    props.traceScheduler.on(
      'set container physical space',
      onPhysicalSpaceChange,
      TraceEventPriority.HIGH
    );
    props.traceScheduler.on(
      'initialize trace space',
      onTraceSpaceChange,
      TraceEventPriority.HIGH
    );

    return () => {
      props.traceScheduler.off('set trace view', onTraceViewChange);
      props.traceScheduler.off('set trace space', onTraceSpaceChange);
      props.traceScheduler.off('set container physical space', onPhysicalSpaceChange);
      props.traceScheduler.off('initialize trace space', onTraceSpaceChange);
    };
  }, [props.traceScheduler, props.view, props.viewManager]);
}
