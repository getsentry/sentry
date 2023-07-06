import {useEffect} from 'react';

import {FlamegraphTheme} from 'sentry/domains/profiling/constants/flamegraphTheme';
import {SelectedFrameRenderer} from 'sentry/domains/profiling/renderers/selectedFrameRenderer';
import {CanvasScheduler} from 'sentry/domains/profiling/utils/profiling/canvasScheduler';
import {CanvasView} from 'sentry/domains/profiling/utils/profiling/canvasView';
import {Flamegraph} from 'sentry/domains/profiling/utils/profiling/flamegraph';
import {FlamegraphCanvas} from 'sentry/domains/profiling/utils/profiling/flamegraphCanvas';
import {FlamegraphFrame} from 'sentry/domains/profiling/utils/profiling/flamegraphFrame';
import {
  SpanChart,
  SpanChartNode,
} from 'sentry/domains/profiling/utils/profiling/spanChart';
import {Rect} from 'sentry/domains/profiling/utils/speedscope';

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
    scheduler.registerBeforeFrameCallback(drawSelectedFrameBorder);
    scheduler.draw();

    return () => {
      scheduler.off(eventKey, onHighlight);
      scheduler.unregisterBeforeFrameCallback(drawSelectedFrameBorder);
    };
  }, [view, canvas, scheduler, renderer, eventKey, theme, selectedRef]);
}
