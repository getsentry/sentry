import {CSSProperties, useEffect, useMemo, useState} from 'react';
import styled from '@emotion/styled';
import {vec2} from 'gl-matrix';

import ConfigStore from 'sentry/stores/configStore';
import {useLegacyStore} from 'sentry/stores/useLegacyStore';
import {defined} from 'sentry/utils';
import {
  CanvasPoolManager,
  useCanvasScheduler,
} from 'sentry/utils/profiling/canvasScheduler';
import {CanvasView} from 'sentry/utils/profiling/canvasView';
import {Flamegraph as FlamegraphModel} from 'sentry/utils/profiling/flamegraph';
import {
  DarkFlamegraphTheme,
  LightFlamegraphTheme,
} from 'sentry/utils/profiling/flamegraph/flamegraphTheme';
import {FlamegraphCanvas} from 'sentry/utils/profiling/flamegraphCanvas';
import {FlamegraphFrame} from 'sentry/utils/profiling/flamegraphFrame';
import {Rect, useResizeCanvasObserver} from 'sentry/utils/profiling/gl/utils';
import {FlamegraphRenderer2D} from 'sentry/utils/profiling/renderers/flamegraphRenderer2D';
import {FlamegraphTextRenderer} from 'sentry/utils/profiling/renderers/flamegraphTextRenderer';
import {formatTo} from 'sentry/utils/profiling/units/units';
import {useProfileGroup} from 'sentry/views/profiling/profileGroupProvider';

interface FlamegraphPreviewProps {
  relativeStartTimestamp: number;
  relativeStopTimestamp: number;
}

export function FlamegraphPreview({
  relativeStartTimestamp,
  relativeStopTimestamp,
}: FlamegraphPreviewProps) {
  const canvasPoolManager = useMemo(() => new CanvasPoolManager(), []);
  const scheduler = useCanvasScheduler(canvasPoolManager);

  const {theme} = useLegacyStore(ConfigStore);
  const flamegraphTheme = theme === 'light' ? LightFlamegraphTheme : DarkFlamegraphTheme;
  const profileGroup = useProfileGroup();

  const threadId = useMemo(
    () => profileGroup.profiles[profileGroup.activeProfileIndex]?.threadId,
    [profileGroup]
  );

  const profile = useMemo(() => {
    if (!defined(threadId)) {
      return null;
    }
    return profileGroup.profiles.find(p => p.threadId === threadId) ?? null;
  }, [profileGroup.profiles, threadId]);

  const flamegraph = useMemo(() => {
    if (!defined(threadId) || !defined(profile)) {
      return FlamegraphModel.Empty();
    }

    return new FlamegraphModel(profile, threadId, {});
  }, [profile, threadId]);

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

    canvasView.setConfigView(
      computePreviewConfigView(
        flamegraph,
        canvasView.configView,
        formatTo(relativeStartTimestamp, 'second', 'nanosecond'),
        formatTo(relativeStopTimestamp, 'second', 'nanosecond')
      )
    );

    return canvasView;
  }, [
    flamegraph,
    flamegraphCanvas,
    flamegraphTheme,
    relativeStartTimestamp,
    relativeStopTimestamp,
  ]);

  const flamegraphCanvases = useMemo(() => [flamegraphCanvasRef], [flamegraphCanvasRef]);

  useResizeCanvasObserver(
    flamegraphCanvases,
    canvasPoolManager,
    flamegraphCanvas,
    flamegraphView
  );

  const flamegraphRenderer = useMemo(() => {
    if (!flamegraphCanvasRef) {
      return null;
    }

    return new FlamegraphRenderer2D(flamegraphCanvasRef, flamegraph, flamegraphTheme, {
      draw_border: true,
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

    const drawText = () => {
      textRenderer.draw(
        flamegraphView.toOriginConfigView(flamegraphView.configView),
        flamegraphView.fromTransformedConfigView(flamegraphCanvas.physicalSpace)
      );
    };

    scheduler.registerBeforeFrameCallback(clearOverlayCanvas);
    scheduler.registerBeforeFrameCallback(drawRectangles);
    scheduler.registerBeforeFrameCallback(drawText);

    scheduler.draw();

    return () => {
      scheduler.unregisterBeforeFrameCallback(clearOverlayCanvas);
      scheduler.unregisterBeforeFrameCallback(drawRectangles);
      scheduler.unregisterBeforeFrameCallback(drawText);
    };
  }, [flamegraphRenderer, flamegraphView, flamegraphCanvas, scheduler, textRenderer]);

  return (
    <CanvasContainer>
      <Canvas ref={setFlamegraphCanvasRef} />
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
): Rect {
  if (flamegraph.depth < configView.height) {
    // if the flamegraph height is less than the config view height,
    // the whole flamechart will fit on the view so we can just use y = 0
    return new Rect(
      relativeStartNs,
      0,
      relativeStopNs - relativeStartNs,
      configView.height
    );
  }

  const frames: FlamegraphFrame[] = flamegraph.root.children.slice();
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
    depth = Math.min(depth, innerMostParentFrame.depth);
  }

  return new Rect(
    relativeStartNs,
    depth,
    relativeStopNs - relativeStartNs,
    configView.height
  );
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
