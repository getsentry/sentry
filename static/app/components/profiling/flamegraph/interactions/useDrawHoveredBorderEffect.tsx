import {useEffect} from 'react';

import {CanvasScheduler} from 'sentry/utils/profiling/canvasScheduler';
import {CanvasView} from 'sentry/utils/profiling/canvasView';
import {Flamegraph} from 'sentry/utils/profiling/flamegraph';
import {FlamegraphTheme} from 'sentry/utils/profiling/flamegraph/flamegraphTheme';
import {FlamegraphCanvas} from 'sentry/utils/profiling/flamegraphCanvas';
import {FlamegraphFrame} from 'sentry/utils/profiling/flamegraphFrame';
import {SelectedFrameRenderer} from 'sentry/utils/profiling/renderers/selectedFrameRenderer';
import {SpanChart, SpanChartNode} from 'sentry/utils/profiling/spanChart';
import {Rect} from 'sentry/utils/profiling/speedscope';

export function useDrawHoveredBorderEffect({
  scheduler,
  view,
  theme,
  canvas,
  renderer,
  hoveredNode,
}: {
  canvas: FlamegraphCanvas | null;
  hoveredNode: FlamegraphFrame | SpanChartNode | null;
  renderer: SelectedFrameRenderer | null;
  scheduler: CanvasScheduler;
  theme: FlamegraphTheme;
  view: CanvasView<Flamegraph | SpanChart> | null;
}) {
  useEffect(() => {
    if (!canvas || !view || !renderer) {
      return undefined;
    }

    const drawHoveredFrameBorder = () => {
      if (hoveredNode) {
        renderer.draw(
          [
            new Rect(
              hoveredNode.start,
              hoveredNode.depth,
              hoveredNode.end - hoveredNode.start,
              1
            ),
          ],
          {
            BORDER_COLOR: theme.COLORS.HOVERED_FRAME_BORDER_COLOR,
            BORDER_WIDTH: theme.SIZES.HOVERED_FRAME_BORDER_WIDTH,
          },
          view.fromTransformedConfigView(canvas.physicalSpace)
        );
      }
    };

    scheduler.registerBeforeFrameCallback(drawHoveredFrameBorder);
    scheduler.draw();

    return () => {
      scheduler.unregisterBeforeFrameCallback(drawHoveredFrameBorder);
    };
  }, [view, canvas, scheduler, hoveredNode, renderer, theme]);
}
