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
