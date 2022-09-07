import {Fragment, useCallback, useEffect, useMemo, useRef, useState} from 'react';
import styled from '@emotion/styled';
import {mat3, vec2} from 'gl-matrix';

import {CanvasPoolManager, CanvasScheduler} from 'sentry/utils/profiling/canvasScheduler';
import {Flamegraph} from 'sentry/utils/profiling/flamegraph';
import {useDispatchFlamegraphState} from 'sentry/utils/profiling/flamegraph/hooks/useFlamegraphState';
import {useFlamegraphTheme} from 'sentry/utils/profiling/flamegraph/useFlamegraphTheme';
import {FlamegraphCanvas} from 'sentry/utils/profiling/flamegraphCanvas';
import {FlamegraphView} from 'sentry/utils/profiling/flamegraphView';
import {Rect} from 'sentry/utils/profiling/gl/utils';
import {FlamegraphRenderer} from 'sentry/utils/profiling/renderers/flamegraphRenderer';
import {PositionIndicatorRenderer} from 'sentry/utils/profiling/renderers/positionIndicatorRenderer';
import usePrevious from 'sentry/utils/usePrevious';

interface FlamegraphZoomViewMinimapProps {
  canvasPoolManager: CanvasPoolManager;
  flamegraph: Flamegraph;
  flamegraphMiniMapCanvas: FlamegraphCanvas | null;
  flamegraphMiniMapCanvasRef: HTMLCanvasElement | null;
  flamegraphMiniMapOverlayCanvasRef: HTMLCanvasElement | null;
  flamegraphMiniMapView: FlamegraphView | null;
  setFlamegraphMiniMapCanvasRef: React.Dispatch<
    React.SetStateAction<HTMLCanvasElement | null>
  >;
  setFlamegraphMiniMapOverlayCanvasRef: React.Dispatch<
    React.SetStateAction<HTMLCanvasElement | null>
  >;
}

function FlamegraphZoomViewMinimap({
  canvasPoolManager,
  flamegraph,
  flamegraphMiniMapCanvas,
  flamegraphMiniMapCanvasRef,
  flamegraphMiniMapOverlayCanvasRef,
  flamegraphMiniMapView,
  setFlamegraphMiniMapCanvasRef,
  setFlamegraphMiniMapOverlayCanvasRef,
}: FlamegraphZoomViewMinimapProps): React.ReactElement {
  const flamegraphTheme = useFlamegraphTheme();
  const [lastInteraction, setLastInteraction] = useState<
    'pan' | 'click' | 'zoom' | 'scroll' | 'select' | null
  >(null);

  const dispatch = useDispatchFlamegraphState();

  const [configSpaceCursor, setConfigSpaceCursor] = useState<vec2 | null>(null);

  const scheduler = useMemo(() => new CanvasScheduler(), []);

  const flamegraphMiniMapRenderer = useMemo(() => {
    if (!flamegraphMiniMapCanvasRef) {
      return null;
    }

    const BAR_HEIGHT =
      flamegraphTheme.SIZES.MINIMAP_HEIGHT /
      (flamegraph.depth + flamegraphTheme.SIZES.FLAMEGRAPH_DEPTH_OFFSET);

    return new FlamegraphRenderer(flamegraphMiniMapCanvasRef, flamegraph, {
      ...flamegraphTheme,
      SIZES: {
        ...flamegraphTheme.SIZES,
        BAR_HEIGHT,
      },
    });
  }, [flamegraph, flamegraphMiniMapCanvasRef, flamegraphTheme]);

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
    if (
      !flamegraphMiniMapCanvas ||
      !flamegraphMiniMapView ||
      !flamegraphMiniMapRenderer
    ) {
      return undefined;
    }

    const drawRectangles = () => {
      flamegraphMiniMapRenderer.draw(
        flamegraphMiniMapView.fromConfigSpace(flamegraphMiniMapCanvas.physicalSpace),
        new Map()
      );
    };

    scheduler.registerBeforeFrameCallback(drawRectangles);

    return () => {
      scheduler.unregisterBeforeFrameCallback(drawRectangles);
    };
  }, [
    flamegraphMiniMapCanvas,
    flamegraphMiniMapRenderer,
    scheduler,
    flamegraphMiniMapView,
  ]);

  useEffect(() => {
    if (
      !flamegraphMiniMapCanvas ||
      !flamegraphMiniMapView ||
      !positionIndicatorRenderer
    ) {
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
        flamegraphMiniMapView.configView,
        flamegraphMiniMapView.configSpace,
        flamegraphMiniMapView.fromConfigSpace(flamegraphMiniMapCanvas.physicalSpace)
      );
    };

    scheduler.registerBeforeFrameCallback(clearOverlayCanvas);
    scheduler.registerAfterFrameCallback(drawPosition);

    scheduler.draw();

    return () => {
      scheduler.unregisterBeforeFrameCallback(clearOverlayCanvas);
      scheduler.unregisterAfterFrameCallback(drawPosition);
    };
  }, [
    flamegraphMiniMapCanvas,
    flamegraphMiniMapView,
    scheduler,
    positionIndicatorRenderer,
  ]);

  const previousInteraction = usePrevious(lastInteraction);
  const beforeInteractionConfigView = useRef<Rect | null>(null);

  useEffect(() => {
    if (!flamegraphMiniMapView) {
      return;
    }

    // Check if we are starting a new interaction
    if (previousInteraction === null && lastInteraction) {
      beforeInteractionConfigView.current = flamegraphMiniMapView.configView.clone();
      return;
    }

    if (
      beforeInteractionConfigView.current &&
      !beforeInteractionConfigView.current.equals(flamegraphMiniMapView.configView)
    ) {
      dispatch({
        type: 'checkpoint',
        payload: flamegraphMiniMapView.configView.clone(),
      });
    }
  }, [lastInteraction, flamegraphMiniMapView, dispatch, previousInteraction]);

  const [startDragVector, setStartDragConfigSpaceCursor] = useState<vec2 | null>(null);
  const [lastDragVector, setLastDragVector] = useState<vec2 | null>(null);

  useEffect(() => {
    canvasPoolManager.registerScheduler(scheduler);
    return () => canvasPoolManager.unregisterScheduler(scheduler);
  }, [scheduler, canvasPoolManager]);

  const onMouseDrag = useCallback(
    (evt: React.MouseEvent<HTMLCanvasElement>) => {
      if (!lastDragVector || !flamegraphMiniMapCanvas || !flamegraphMiniMapView) {
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
        flamegraphMiniMapView.fromConfigSpace(flamegraphMiniMapCanvas.physicalSpace)
      );

      const configDelta = vec2.transformMat3(
        vec2.create(),
        physicalDelta,
        physicalToConfig
      );

      canvasPoolManager.dispatch('transform config view', [
        mat3.fromTranslation(mat3.create(), configDelta),
      ]);

      setLastDragVector(physicalMousePos);
    },
    [flamegraphMiniMapCanvas, flamegraphMiniMapView, lastDragVector, canvasPoolManager]
  );

  const onMinimapCanvasMouseMove = useCallback(
    (evt: React.MouseEvent<HTMLCanvasElement>) => {
      if (!flamegraphMiniMapCanvas || !flamegraphMiniMapView) {
        return;
      }

      const configSpaceMouse = flamegraphMiniMapView.getConfigSpaceCursor(
        vec2.fromValues(evt.nativeEvent.offsetX, evt.nativeEvent.offsetY),
        flamegraphMiniMapCanvas
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
          configSpaceMouse[1] - flamegraphMiniMapView.configView.height / 2,
          end[0] - start[0],
          flamegraphMiniMapView.configView.height
        );
        canvasPoolManager.dispatch('set config view', [rect]);
        setLastInteraction('select');
        return;
      }

      setLastInteraction(null);
    },
    [
      flamegraphMiniMapCanvas,
      flamegraphMiniMapView,
      canvasPoolManager,
      lastDragVector,
      onMouseDrag,
      startDragVector,
    ]
  );

  const onMinimapScroll = useCallback(
    (evt: WheelEvent) => {
      if (!flamegraphMiniMapCanvas || !flamegraphMiniMapView) {
        return;
      }

      {
        const physicalDelta = vec2.fromValues(evt.deltaX * 0.8, evt.deltaY);
        const physicalToConfig = mat3.invert(
          mat3.create(),
          flamegraphMiniMapView.fromConfigView(flamegraphMiniMapCanvas.physicalSpace)
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
        canvasPoolManager.dispatch('transform config view', [translate]);
      }
    },
    [flamegraphMiniMapCanvas, flamegraphMiniMapView, canvasPoolManager]
  );

  const onMinimapZoom = useCallback(
    (evt: WheelEvent) => {
      if (!flamegraphMiniMapCanvas || !flamegraphMiniMapView) {
        return;
      }

      const identity = mat3.identity(mat3.create());
      const scale = 1 - evt.deltaY * 0.001 * -1; // -1 to invert scale

      const mouseInConfigSpace = flamegraphMiniMapView.getConfigSpaceCursor(
        vec2.fromValues(evt.offsetX, evt.offsetY),
        flamegraphMiniMapCanvas
      );

      const configCenter = vec2.fromValues(
        mouseInConfigSpace[0],
        flamegraphMiniMapView.configView.y
      );

      const invertedConfigCenter = vec2.multiply(
        vec2.create(),
        vec2.fromValues(-1, -1),
        configCenter
      );

      const translated = mat3.translate(mat3.create(), identity, configCenter);
      const scaled = mat3.scale(mat3.create(), translated, vec2.fromValues(scale, 1));
      const translatedBack = mat3.translate(mat3.create(), scaled, invertedConfigCenter);

      canvasPoolManager.dispatch('transform config view', [translatedBack]);
    },
    [flamegraphMiniMapCanvas, flamegraphMiniMapView, canvasPoolManager]
  );

  const onMinimapCanvasMouseDown = useCallback(
    evt => {
      if (
        !configSpaceCursor ||
        !flamegraphMiniMapCanvas ||
        !flamegraphMiniMapView ||
        !canvasPoolManager
      ) {
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

      if (flamegraphMiniMapView.configView.contains(configSpaceCursor)) {
        setLastDragVector(physicalMousePos);
      } else {
        const startConfigSpaceCursor = flamegraphMiniMapView.getConfigSpaceCursor(
          vec2.fromValues(evt.nativeEvent.offsetX, evt.nativeEvent.offsetY),
          flamegraphMiniMapCanvas
        );
        setStartDragConfigSpaceCursor(startConfigSpaceCursor);
      }
      setLastInteraction('select');
    },
    [configSpaceCursor, flamegraphMiniMapCanvas, flamegraphMiniMapView, canvasPoolManager]
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

      evt.preventDefault();

      // When we zoom, we want to clear cursor so that any tooltips
      // rendered on the flamegraph are removed from the view
      setConfigSpaceCursor(null);

      if (evt.metaKey || evt.ctrlKey) {
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
  }, [flamegraphMiniMapCanvasRef, onMinimapZoom, onMinimapScroll]);

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
        ref={c => setFlamegraphMiniMapCanvasRef(c)}
        onMouseDown={onMinimapCanvasMouseDown}
        onMouseMove={onMinimapCanvasMouseMove}
        onMouseLeave={onMinimapCanvasMouseUp}
        cursor={
          configSpaceCursor &&
          flamegraphMiniMapView?.configView.contains(configSpaceCursor)
            ? 'grab'
            : 'col-resize'
        }
      />
      <OverlayCanvas ref={c => setFlamegraphMiniMapOverlayCanvasRef(c)} />
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
