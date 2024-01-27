import {useEffect} from 'react';

import type {CanvasScheduler} from 'sentry/utils/profiling/canvasScheduler';
import type {CanvasView} from 'sentry/utils/profiling/canvasView';
import type {Flamegraph} from 'sentry/utils/profiling/flamegraph';
import type {FlamegraphTheme} from 'sentry/utils/profiling/flamegraph/flamegraphTheme';
import type {FlamegraphCanvas} from 'sentry/utils/profiling/flamegraphCanvas';
import type {FlamegraphFrame} from 'sentry/utils/profiling/flamegraphFrame';
import type {SelectedFrameRenderer} from 'sentry/utils/profiling/renderers/selectedFrameRenderer';
import type {SpanChart, SpanChartNode} from 'sentry/utils/profiling/spanChart';
import {Rect} from 'sentry/utils/profiling/speedscope';

export function useDrawSelectedBorderEffect({
  scheduler,
  view,
  theme,
  canvas,
  eventKey,
  renderer,
  selectedRef,
}: {
  canvas: FlamegraphCanvas | null;
  eventKey: 'highlight frame' | 'highlight span';
  renderer: SelectedFrameRenderer | null;
  scheduler: CanvasScheduler;
  selectedRef: React.MutableRefObject<FlamegraphFrame[] | SpanChartNode[] | null>;
  theme: FlamegraphTheme;
  view: CanvasView<Flamegraph | SpanChart> | null;
}) {
  useEffect(() => {
    if (!canvas || !view || !renderer) {
      return undefined;
    }
    function onHighlight(
      node: FlamegraphFrame[] | SpanChartNode[] | null,
      mode: 'hover' | 'selected'
    ) {
      if (mode === 'selected') {
        selectedRef.current = node;
      }
      scheduler.draw();
    }

    const drawSelectedFrameBorder = () => {
      if (selectedRef.current) {
        renderer.draw(
          selectedRef.current.map(frame => {
            return new Rect(frame.start, frame.depth, frame.end - frame.start, 1);
          }),
          {
            BORDER_COLOR: theme.COLORS.SELECTED_FRAME_BORDER_COLOR,
            BORDER_WIDTH: theme.SIZES.HIGHLIGHTED_FRAME_BORDER_WIDTH,
          },
          view.fromTransformedConfigView(canvas.physicalSpace)
        );
      }
    };

    scheduler.on(eventKey, onHighlight);
    scheduler.registerAfterFrameCallback(drawSelectedFrameBorder);
    scheduler.draw();

    return () => {
      scheduler.off(eventKey, onHighlight);
      scheduler.unregisterAfterFrameCallback(drawSelectedFrameBorder);
    };
  }, [view, canvas, scheduler, renderer, eventKey, theme, selectedRef]);
}
