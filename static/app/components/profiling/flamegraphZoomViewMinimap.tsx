import {Fragment, useCallback, useEffect, useMemo, useRef, useState} from 'react';
import styled from '@emotion/styled';
import {mat3, vec2} from 'gl-matrix';

import {CanvasPoolManager, CanvasScheduler} from 'sentry/utils/profiling/canvasScheduler';
import {Flamegraph} from 'sentry/utils/profiling/flamegraph';
import {useFlamegraphPreferencesValue} from 'sentry/utils/profiling/flamegraph/useFlamegraphPreferences';
import {useDispatchFlamegraphState} from 'sentry/utils/profiling/flamegraph/useFlamegraphState';
import {useFlamegraphTheme} from 'sentry/utils/profiling/flamegraph/useFlamegraphTheme';
import {FlamegraphFrame} from 'sentry/utils/profiling/flamegraphFrame';
import {Rect, watchForResize} from 'sentry/utils/profiling/gl/utils';
import {FlamegraphRenderer} from 'sentry/utils/profiling/renderers/flamegraphRenderer';
import {PositionIndicatorRenderer} from 'sentry/utils/profiling/renderers/positionIndicatorRenderer';
import {useMemoWithPrevious} from 'sentry/utils/useMemoWithPrevious';
import usePrevious from 'sentry/utils/usePrevious';

interface FlamegraphZoomViewMinimapProps {
  canvasPoolManager: CanvasPoolManager;
  flamegraph: Flamegraph;
}

function FlamegraphZoomViewMinimap({
  canvasPoolManager,
  flamegraph,
}: FlamegraphZoomViewMinimapProps): React.ReactElement {
  const flamegraphTheme = useFlamegraphTheme();
  const [lastInteraction, setLastInteraction] = useState<
    'pan' | 'click' | 'zoom' | 'scroll' | 'select' | null
  >(null);

  const [dispatch] = useDispatchFlamegraphState();
  const flamegraphPreferences = useFlamegraphPreferencesValue();

  const [flamegraphMiniMapCanvasRef, setFlamegraphMiniMapRef] =
    useState<HTMLCanvasElement | null>(null);
  const [flamegraphMiniMapOverlayCanvasRef, setFlamegraphMiniMapOverlayCanvasRef] =
    useState<HTMLCanvasElement | null>(null);
  const [configSpaceCursor, setConfigSpaceCursor] = useState<vec2 | null>(null);

  const scheduler = useMemo(() => new CanvasScheduler(), []);

  const flamegraphMiniMapRenderer = useMemoWithPrevious<FlamegraphRenderer | null>(
    previousRenderer => {
      if (!flamegraphMiniMapCanvasRef) {
        return null;
      }

      const BAR_HEIGHT =
        flamegraphTheme.SIZES.MINIMAP_HEIGHT /
        (flamegraph.depth + flamegraphTheme.SIZES.FLAMEGRAPH_DEPTH_OFFSET);

      const renderer = new FlamegraphRenderer(flamegraphMiniMapCanvasRef, flamegraph, {
        ...flamegraphTheme,
        SIZES: {
          ...flamegraphTheme.SIZES,
          BAR_HEIGHT,
        },
      });

      if (!previousRenderer?.configSpace.equals(renderer.configSpace)) {
        return renderer;
      }

      if (previousRenderer?.flamegraph.profile === renderer.flamegraph.profile) {
        if (previousRenderer.flamegraph.leftHeavy !== renderer.flamegraph.leftHeavy) {
          // When the user toggles left heavy, the entire flamegraph will take
          // on a different shape. In this case, there's no obvious position
          // that can be carried over.
        } else {
          renderer.setConfigView(previousRenderer.configView);
        }
      }

      return renderer;
    },
    [
      flamegraphMiniMapCanvasRef,
      flamegraph,
      flamegraphTheme,
      flamegraphPreferences.colorCoding,
    ]
  );

  const positionIndicatorRenderer: PositionIndicatorRenderer | null = useMemo(() => {
    if (!flamegraphMiniMapOverlayCanvasRef) {
      return null;
    }

    return new PositionIndicatorRenderer(
      flamegraphMiniMapOverlayCanvasRef,
      flamegraphTheme
    );
  }, [flamegraphMiniMapOverlayCanvasRef, flamegraphTheme]);

  useEffect(() => {
    if (!flamegraphMiniMapRenderer) {
      return undefined;
    }

    const drawRectangles = () => {
      flamegraphMiniMapRenderer.draw(
        null,
        flamegraphMiniMapRenderer.configSpaceToPhysicalSpace
      );
    };

    scheduler.registerBeforeFrameCallback(drawRectangles);

    return () => {
      scheduler.unregisterBeforeFrameCallback(drawRectangles);
    };
  }, [scheduler, flamegraphMiniMapRenderer]);

  useEffect(() => {
    if (!flamegraphMiniMapRenderer || !positionIndicatorRenderer) {
      return undefined;
    }

    const clearOverlayCanvas = () => {
      positionIndicatorRenderer.context.clearRect(
        0,
        0,
        positionIndicatorRenderer.canvas.width,
        positionIndicatorRenderer.canvas.height
      );
    };

    const drawPosition = () => {
      positionIndicatorRenderer.draw(
        flamegraphMiniMapRenderer.configView,
        flamegraphMiniMapRenderer.configSpace,
        flamegraphMiniMapRenderer.configSpaceToPhysicalSpace
      );
    };

    scheduler.registerBeforeFrameCallback(clearOverlayCanvas);
    scheduler.registerAfterFrameCallback(drawPosition);

    scheduler.draw();

    return () => {
      scheduler.unregisterBeforeFrameCallback(clearOverlayCanvas);
      scheduler.unregisterAfterFrameCallback(drawPosition);
    };
  }, [scheduler, flamegraphMiniMapRenderer, positionIndicatorRenderer]);

  useEffect(() => {
    if (!flamegraphMiniMapRenderer) {
      return undefined;
    }

    const onConfigViewChange = (rect: Rect) => {
      flamegraphMiniMapRenderer.setConfigView(rect);
      scheduler.draw();
    };

    const onTransformConfigView = (mat: mat3) => {
      flamegraphMiniMapRenderer.transformConfigView(mat);
      scheduler.draw();
    };

    const onResetZoom = () => {
      flamegraphMiniMapRenderer.resetConfigView();
      setConfigSpaceCursor(null);
      scheduler.draw();
    };

    const onZoomIntoFrame = (frame: FlamegraphFrame) => {
      flamegraphMiniMapRenderer.setConfigView(
        new Rect(
          frame.start,
          frame.depth,
          frame.end - frame.start,
          flamegraphMiniMapRenderer.configView.height
        )
      );

      setConfigSpaceCursor(null);
      scheduler.draw();
    };

    scheduler.on('setConfigView', onConfigViewChange);
    scheduler.on('transformConfigView', onTransformConfigView);
    scheduler.on('resetZoom', onResetZoom);
    scheduler.on('zoomIntoFrame', onZoomIntoFrame);

    return () => {
      scheduler.off('setConfigView', onConfigViewChange);
      scheduler.off('transformConfigView', onTransformConfigView);
      scheduler.off('resetZoom', onResetZoom);
      scheduler.off('zoomIntoFrame', onZoomIntoFrame);
    };
  }, [scheduler, flamegraphMiniMapRenderer]);

  const previousInteraction = usePrevious(lastInteraction);
  const beforeInteractionConfigView = useRef<Rect | null>(null);

  useEffect(() => {
    if (!flamegraphMiniMapRenderer) {
      return;
    }

    // Check if we are starting a new interaction
    if (previousInteraction === null && lastInteraction) {
      beforeInteractionConfigView.current = flamegraphMiniMapRenderer.configView.clone();
      return;
    }

    if (
      beforeInteractionConfigView.current &&
      !beforeInteractionConfigView.current.equals(flamegraphMiniMapRenderer.configView)
    ) {
      dispatch({
        type: 'checkpoint',
        payload: flamegraphMiniMapRenderer.configView.clone(),
      });
    }
  }, [lastInteraction, flamegraphMiniMapRenderer, dispatch, previousInteraction]);

  const [startDragVector, setStartDragConfigSpaceCursor] = useState<vec2 | null>(null);
  const [lastDragVector, setLastDragVector] = useState<vec2 | null>(null);

  useEffect(() => {
    if (
      !flamegraphMiniMapCanvasRef ||
      !flamegraphMiniMapOverlayCanvasRef ||
      !flamegraphMiniMapRenderer
    ) {
      return undefined;
    }

    const observer = watchForResize(
      [flamegraphMiniMapCanvasRef, flamegraphMiniMapOverlayCanvasRef],
      () => {
        flamegraphMiniMapRenderer.onResizeUpdateSpace();
        scheduler.drawSync();
      }
    );

    return () => observer.disconnect();
  }, [
    scheduler,
    flamegraphMiniMapCanvasRef,
    flamegraphMiniMapOverlayCanvasRef,
    flamegraphMiniMapRenderer,
  ]);

  useEffect(() => {
    canvasPoolManager.registerScheduler(scheduler);
    return () => canvasPoolManager.unregisterScheduler(scheduler);
  }, [scheduler, canvasPoolManager]);

  const onMouseDrag = useCallback(
    (evt: React.MouseEvent<HTMLCanvasElement>) => {
      if (!lastDragVector || !flamegraphMiniMapRenderer) {
        return;
      }

      const logicalMousePos = vec2.fromValues(
        evt.nativeEvent.offsetX,
        evt.nativeEvent.offsetY
      );
      const physicalMousePos = vec2.scale(
        vec2.create(),
        logicalMousePos,
        window.devicePixelRatio
      );

      const physicalDelta = vec2.subtract(
        vec2.create(),
        physicalMousePos,
        lastDragVector
      );

      if (physicalDelta[0] === 0 && physicalDelta[1] === 0) {
        return;
      }

      const physicalToConfig = mat3.invert(
        mat3.create(),
        flamegraphMiniMapRenderer.configSpaceToPhysicalSpace
      );

      const configDelta = vec2.transformMat3(
        vec2.create(),
        physicalDelta,
        physicalToConfig
      );

      canvasPoolManager.dispatch('transformConfigView', [
        mat3.fromTranslation(mat3.create(), configDelta),
      ]);

      setLastDragVector(physicalMousePos);
    },
    [flamegraphMiniMapRenderer, lastDragVector, canvasPoolManager]
  );

  const onMinimapCanvasMouseMove = useCallback(
    (evt: React.MouseEvent<HTMLCanvasElement>) => {
      if (!flamegraphMiniMapRenderer || !flamegraphMiniMapRenderer.frames.length) {
        return;
      }

      const configSpaceMouse = flamegraphMiniMapRenderer.getConfigSpaceCursor(
        vec2.fromValues(evt.nativeEvent.offsetX, evt.nativeEvent.offsetY),
        flamegraphMiniMapRenderer.configSpaceToPhysicalSpace
      );

      setConfigSpaceCursor(configSpaceMouse);

      if (lastDragVector) {
        onMouseDrag(evt);
        setLastInteraction('pan');
        return;
      }
      if (startDragVector) {
        const start = vec2.min(vec2.create(), startDragVector, configSpaceMouse);
        const end = vec2.max(vec2.create(), startDragVector, configSpaceMouse);

        const rect = new Rect(
          start[0],
          configSpaceMouse[1] - flamegraphMiniMapRenderer.configView.height / 2,
          end[0] - start[0],
          flamegraphMiniMapRenderer.configView.height
        );
        canvasPoolManager.dispatch('setConfigView', [rect]);
        setLastInteraction('select');
        return;
      }

      setLastInteraction(null);
    },
    [
      canvasPoolManager,
      flamegraphMiniMapRenderer,
      lastDragVector,
      onMouseDrag,
      startDragVector,
    ]
  );

  const onMinimapScroll = useCallback(
    (evt: WheelEvent) => {
      if (!flamegraphMiniMapRenderer || !flamegraphMiniMapRenderer.frames.length) {
        return;
      }

      {
        const physicalDelta = vec2.fromValues(evt.deltaX * 0.8, evt.deltaY);
        const physicalToConfig = mat3.invert(
          mat3.create(),
          flamegraphMiniMapRenderer.configSpaceToPhysicalSpace
        );
        const [m00, m01, m02, m10, m11, m12] = physicalToConfig;

        const configDelta = vec2.transformMat3(vec2.create(), physicalDelta, [
          m00,
          m01,
          m02,
          m10,
          m11,
          m12,
          0,
          0,
          0,
        ]);

        const translate = mat3.fromTranslation(mat3.create(), configDelta);
        canvasPoolManager.dispatch('transformConfigView', [translate]);
      }
    },
    [flamegraphMiniMapRenderer, canvasPoolManager]
  );

  const onMinimapZoom = useCallback(
    (evt: WheelEvent) => {
      if (!flamegraphMiniMapRenderer || !flamegraphMiniMapRenderer.frames.length) {
        return;
      }

      const identity = mat3.identity(mat3.create());
      const scale = 1 - evt.deltaY * 0.001 * -1; // -1 to invert scale

      const mouseInConfigSpace = flamegraphMiniMapRenderer.getConfigSpaceCursor(
        vec2.fromValues(evt.offsetX, evt.offsetY),
        flamegraphMiniMapRenderer.configSpaceToPhysicalSpace
      );

      const configCenter = vec2.fromValues(
        mouseInConfigSpace[0],
        flamegraphMiniMapRenderer.configView.y
      );

      const invertedConfigCenter = vec2.multiply(
        vec2.create(),
        vec2.fromValues(-1, -1),
        configCenter
      );

      const translated = mat3.translate(mat3.create(), identity, configCenter);
      const scaled = mat3.scale(mat3.create(), translated, vec2.fromValues(scale, 1));
      const translatedBack = mat3.translate(mat3.create(), scaled, invertedConfigCenter);

      canvasPoolManager.dispatch('transformConfigView', [translatedBack]);
    },
    [flamegraphMiniMapRenderer, canvasPoolManager]
  );

  const onMinimapCanvasMouseDown = useCallback(
    evt => {
      if (!configSpaceCursor || !flamegraphMiniMapRenderer || !canvasPoolManager) {
        return;
      }

      const logicalMousePos = vec2.fromValues(
        evt.nativeEvent.offsetX,
        evt.nativeEvent.offsetY
      );
      const physicalMousePos = vec2.scale(
        vec2.create(),
        logicalMousePos,
        window.devicePixelRatio
      );

      if (flamegraphMiniMapRenderer.configView.contains(configSpaceCursor)) {
        setLastDragVector(physicalMousePos);
      } else {
        const startConfigSpaceCursor = flamegraphMiniMapRenderer.getConfigSpaceCursor(
          vec2.fromValues(evt.nativeEvent.offsetX, evt.nativeEvent.offsetY),
          flamegraphMiniMapRenderer.configSpaceToPhysicalSpace
        );
        setStartDragConfigSpaceCursor(startConfigSpaceCursor);
      }
      setLastInteraction('select');
    },
    [configSpaceCursor, flamegraphMiniMapRenderer, canvasPoolManager]
  );

  const onMinimapCanvasMouseUp = useCallback(() => {
    setConfigSpaceCursor(null);
    setStartDragConfigSpaceCursor(null);
    setLastDragVector(null);
    setLastInteraction(null);
  }, []);

  useEffect(() => {
    if (!flamegraphMiniMapCanvasRef) {
      return undefined;
    }

    let wheelStopTimeoutId: number | undefined;
    function onCanvasWheel(evt: WheelEvent) {
      window.clearTimeout(wheelStopTimeoutId);
      wheelStopTimeoutId = window.setTimeout(() => {
        setLastInteraction(null);
      }, 300);

      if (!flamegraphMiniMapRenderer) {
        return;
      }
      evt.preventDefault();

      // When we zoom, we want to clear cursor so that any tooltips
      // rendered on the flamegraph are removed from the view
      setConfigSpaceCursor(null);

      if (evt.metaKey) {
        onMinimapZoom(evt);
        setLastInteraction('zoom');
      } else {
        onMinimapScroll(evt);
        setLastInteraction('scroll');
      }
    }

    flamegraphMiniMapCanvasRef.addEventListener('wheel', onCanvasWheel);

    return () => {
      window.clearTimeout(wheelStopTimeoutId);
      flamegraphMiniMapCanvasRef.removeEventListener('wheel', onCanvasWheel);
    };
  }, [
    flamegraphMiniMapCanvasRef,
    flamegraphMiniMapRenderer,
    onMinimapZoom,
    onMinimapScroll,
  ]);

  useEffect(() => {
    window.addEventListener('mouseup', onMinimapCanvasMouseUp);

    return () => {
      window.removeEventListener('mouseup', onMinimapCanvasMouseUp);
    };
  }, [onMinimapCanvasMouseUp]);

  useEffect(() => {
    if (!flamegraphMiniMapCanvasRef) {
      return undefined;
    }

    const onCanvasWheel = (evt: WheelEvent) => {
      evt.preventDefault();
      const isZoom = evt.metaKey;

      // @TODO figure out what key to use for other platforms
      if (isZoom) {
        onMinimapZoom(evt);
      } else {
        onMinimapScroll(evt);
      }
    };

    flamegraphMiniMapCanvasRef.addEventListener('wheel', onCanvasWheel);
    return () => flamegraphMiniMapCanvasRef?.removeEventListener('wheel', onCanvasWheel);
  }, [flamegraphMiniMapCanvasRef, onMinimapScroll, onMinimapZoom]);

  return (
    <Fragment>
      <Canvas
        ref={canvas => setFlamegraphMiniMapRef(canvas)}
        onMouseDown={onMinimapCanvasMouseDown}
        onMouseMove={onMinimapCanvasMouseMove}
        onMouseLeave={onMinimapCanvasMouseUp}
        cursor={
          configSpaceCursor &&
          flamegraphMiniMapRenderer?.configView.contains(configSpaceCursor)
            ? 'grab'
            : 'col-resize'
        }
      />
      <OverlayCanvas ref={canvas => setFlamegraphMiniMapOverlayCanvasRef(canvas)} />
    </Fragment>
  );
}

const Canvas = styled('canvas')<{cursor?: React.CSSProperties['cursor']}>`
  width: 100%;
  height: 100%;
  position: absolute;
  left: 0;
  top: 0;
  cursor: ${props => props.cursor ?? 'default'};
  user-select: none;
`;

const OverlayCanvas = styled(Canvas)`
  pointer-events: none;
`;

export {FlamegraphZoomViewMinimap};
