import {CSSProperties, useCallback, useEffect, useMemo, useState} from 'react';
import styled from '@emotion/styled';
import {vec2} from 'gl-matrix';

import {FlamegraphTooltip} from 'sentry/components/profiling/flamegraph/flamegraphTooltip';
import {defined} from 'sentry/utils';
import {
  CanvasPoolManager,
  useCanvasScheduler,
} from 'sentry/utils/profiling/canvasScheduler';
import {CanvasView} from 'sentry/utils/profiling/canvasView';
import {Flamegraph as FlamegraphModel} from 'sentry/utils/profiling/flamegraph';
import {useFlamegraphTheme} from 'sentry/utils/profiling/flamegraph/useFlamegraphTheme';
import {FlamegraphCanvas} from 'sentry/utils/profiling/flamegraphCanvas';
import {FlamegraphFrame} from 'sentry/utils/profiling/flamegraphFrame';
import {useResizeCanvasObserver} from 'sentry/utils/profiling/gl/utils';
import {FlamegraphRenderer2D} from 'sentry/utils/profiling/renderers/flamegraphRenderer2D';
import {FlamegraphTextRenderer} from 'sentry/utils/profiling/renderers/flamegraphTextRenderer';
import {Rect} from 'sentry/utils/profiling/speedscope';
import {formatTo} from 'sentry/utils/profiling/units/units';

interface FlamegraphPreviewProps {
  flamegraph: FlamegraphModel;
  relativeStartTimestamp: number;
  relativeStopTimestamp: number;
  renderText?: boolean;
  updateFlamegraphView?: (canvasView: CanvasView<FlamegraphModel> | null) => void;
}

export function FlamegraphPreview({
  flamegraph,
  relativeStartTimestamp,
  relativeStopTimestamp,
  renderText = true,
  updateFlamegraphView,
}: FlamegraphPreviewProps) {
  const [configSpaceCursor, setConfigSpaceCursor] = useState<vec2 | null>(null);
  const canvasPoolManager = useMemo(() => new CanvasPoolManager(), []);
  const scheduler = useCanvasScheduler(canvasPoolManager);

  const flamegraphTheme = useFlamegraphTheme();

  const [flamegraphCanvasRef, setFlamegraphCanvasRef] =
    useState<HTMLCanvasElement | null>(null);

  const flamegraphCanvas = useMemo(() => {
    if (!flamegraphCanvasRef) {
      return null;
    }
    return new FlamegraphCanvas(flamegraphCanvasRef, vec2.fromValues(0, 0));
  }, [flamegraphCanvasRef]);

  const flamegraphView = useMemo(() => {
    if (!flamegraphCanvas) {
      return null;
    }

    const canvasView = new CanvasView({
      canvas: flamegraphCanvas,
      model: flamegraph,
      options: {barHeight: flamegraphTheme.SIZES.BAR_HEIGHT},
      mode: 'anchorBottom',
    });

    const {configView, mode} = computePreviewConfigView(
      flamegraph,
      canvasView.configView,
      formatTo(relativeStartTimestamp, 'second', 'nanosecond'),
      formatTo(relativeStopTimestamp, 'second', 'nanosecond')
    );

    canvasView.setConfigView(configView);
    canvasView.mode = mode;

    return canvasView;
  }, [
    flamegraph,
    flamegraphCanvas,
    flamegraphTheme,
    relativeStartTimestamp,
    relativeStopTimestamp,
  ]);

  useEffect(() => {
    updateFlamegraphView?.(flamegraphView);
  }, [flamegraphView, updateFlamegraphView]);

  const flamegraphCanvases = useMemo(() => [flamegraphCanvasRef], [flamegraphCanvasRef]);

  const flamegraphRenderer = useMemo(() => {
    if (!flamegraphCanvasRef) {
      return null;
    }

    return new FlamegraphRenderer2D(flamegraphCanvasRef, flamegraph, flamegraphTheme, {
      draw_border: true,
      colorCoding: 'by system vs application frame',
    });
  }, [flamegraph, flamegraphCanvasRef, flamegraphTheme]);

  const textRenderer = useMemo(() => {
    if (!flamegraphCanvasRef) {
      return null;
    }
    return new FlamegraphTextRenderer(flamegraphCanvasRef, flamegraphTheme, flamegraph);
  }, [flamegraph, flamegraphCanvasRef, flamegraphTheme]);

  useEffect(() => {
    if (!flamegraphCanvas || !flamegraphView || !flamegraphRenderer || !textRenderer) {
      return undefined;
    }

    const clearOverlayCanvas = () => {
      textRenderer.context.clearRect(
        0,
        0,
        textRenderer.canvas.width,
        textRenderer.canvas.height
      );
    };

    const drawRectangles = () => {
      flamegraphRenderer.draw(
        flamegraphView.fromTransformedConfigView(flamegraphCanvas.physicalSpace)
      );
    };

    const drawText = renderText
      ? () => {
          textRenderer.draw(
            flamegraphView.toOriginConfigView(flamegraphView.configView),
            flamegraphView.fromTransformedConfigView(flamegraphCanvas.physicalSpace)
          );
        }
      : null;

    scheduler.registerBeforeFrameCallback(clearOverlayCanvas);
    scheduler.registerBeforeFrameCallback(drawRectangles);
    if (drawText) {
      scheduler.registerBeforeFrameCallback(drawText);
    }

    scheduler.draw();

    return () => {
      scheduler.unregisterBeforeFrameCallback(clearOverlayCanvas);
      scheduler.unregisterBeforeFrameCallback(drawRectangles);
      if (drawText) {
        scheduler.unregisterBeforeFrameCallback(drawText);
      }
    };
  }, [
    flamegraphRenderer,
    flamegraphView,
    flamegraphCanvas,
    renderText,
    scheduler,
    textRenderer,
  ]);

  const hoveredNode: FlamegraphFrame | null = useMemo(() => {
    if (!configSpaceCursor || !flamegraphRenderer) {
      return null;
    }
    return flamegraphRenderer.findHoveredNode(configSpaceCursor);
  }, [configSpaceCursor, flamegraphRenderer]);

  const onCanvasMouseMove = useCallback(
    (evt: React.MouseEvent<HTMLCanvasElement>) => {
      if (!flamegraphCanvas || !flamegraphView) {
        return;
      }

      setConfigSpaceCursor(
        flamegraphView.getTransformedConfigViewCursor(
          vec2.fromValues(evt.nativeEvent.offsetX, evt.nativeEvent.offsetY),
          flamegraphCanvas
        )
      );
    },
    [flamegraphCanvas, flamegraphView]
  );

  const onCanvasMouseLeave = useCallback(() => {
    setConfigSpaceCursor(null);
  }, []);

  const canvasBounds = useResizeCanvasObserver(
    flamegraphCanvases,
    canvasPoolManager,
    flamegraphCanvas,
    flamegraphView
  );

  return (
    <CanvasContainer>
      <Canvas
        ref={setFlamegraphCanvasRef}
        onMouseMove={onCanvasMouseMove}
        onMouseLeave={onCanvasMouseLeave}
      />
      {renderText &&
      flamegraphCanvas &&
      flamegraphRenderer &&
      flamegraphView &&
      configSpaceCursor &&
      hoveredNode ? (
        <FlamegraphTooltip
          frame={hoveredNode}
          flamegraph={flamegraph}
          configSpaceCursor={configSpaceCursor}
          flamegraphCanvas={flamegraphCanvas}
          flamegraphRenderer={flamegraphRenderer}
          flamegraphView={flamegraphView}
          canvasBounds={canvasBounds}
          platform={undefined}
        />
      ) : null}
    </CanvasContainer>
  );
}

/**
 * When generating a preview, a relative start/stop timestamp is used to specify
 * the x position of the flamechart to render. This function tries to pick the
 * best y position based on the x in order to show the most useful part of the
 * flamechart.
 *
 * It works as follows:
 * - If there are frames that wrap the time window (a parent frame), we will pick
 *   the inner most parent frame's depth and start rendering from there.
 * - Otherwise, we will pick based on the maximum depth of the flamechart within
 *   the specified window and show as many rows as that will fit. We do not rely
 *   on using the maximum depth of the whole flamechart and adjusting the config
 *   view because the window selected may be shallower and would result in the
 *   preview to show a lot of whitespace.
 */
export function computePreviewConfigView(
  flamegraph: FlamegraphModel,
  configView: Rect,
  relativeStartNs: number,
  relativeStopNs: number
): {
  configView: Rect;
  mode: CanvasView<FlamegraphModel>['mode'];
} {
  if (flamegraph.depth < configView.height) {
    // if the flamegraph height is less than the config view height,
    // the whole flamechart will fit on the view so we can just use y = 0
    return {
      configView: new Rect(
        relativeStartNs,
        0,
        relativeStopNs - relativeStartNs,
        configView.height
      ),
      // If we're setting y = 0, we'll anchor the config view at the top
      // because we want to show more from the bottom
      mode: 'anchorTop',
    };
  }

  const frames: FlamegraphFrame[] = flamegraph.root.children.slice();

  // If we're using the max depth in the window, then we want to anchor it
  // from the bottom because if the config view grows, we want to show more
  // frames from the top. If we showed more frames from the bottom then it
  // would just show whitespace.
  let mode: CanvasView<FlamegraphModel>['mode'] = 'anchorBottom';

  let maxDepthInWindow = 0;
  let innerMostParentFrame: FlamegraphFrame | null = null;

  while (frames.length > 0) {
    const frame = frames.pop()!;

    if (frame.start >= relativeStopNs || frame.end <= relativeStartNs) {
      continue;
    }

    maxDepthInWindow = Math.max(maxDepthInWindow, frame.depth);

    if (frame.start <= relativeStartNs && frame.end >= relativeStopNs) {
      if ((innerMostParentFrame?.depth ?? -1) < frame.depth) {
        innerMostParentFrame = frame;
      }
    }

    for (let i = 0; i < frame.children.length; i++) {
      frames.push(frame.children[i]);
    }
  }

  // By default, we show the inner most frames.
  let depth = Math.max(0, Math.ceil(maxDepthInWindow - configView.height + 1));

  // If we were able to find a frame that is likely the parent of the span,
  // we should bias towards that frame.
  if (defined(innerMostParentFrame)) {
    if (depth > innerMostParentFrame.depth) {
      // If we find the inner most parent frame, then we anchor it top the top
      // because there may be more frames out of view at the bottom, so if the
      // config view grows, we want to show those first
      mode = 'anchorTop';
      depth = innerMostParentFrame.depth;
    }
  }

  return {
    configView: new Rect(
      relativeStartNs,
      depth,
      relativeStopNs - relativeStartNs,
      configView.height
    ),
    mode,
  };
}

const CanvasContainer = styled('div')`
  display: flex;
  flex-direction: column;
  height: 100%;
  position: relative;
`;

const Canvas = styled('canvas')<{
  cursor?: CSSProperties['cursor'];
  pointerEvents?: CSSProperties['pointerEvents'];
}>`
  left: 0;
  top: 0;
  width: 100%;
  height: 100%;
  user-select: none;
  position: absolute;
  pointer-events: ${p => p.pointerEvents || 'auto'};
  cursor: ${p => p.cursor || 'default'};

  &:focus {
    outline: none;
  }
`;
