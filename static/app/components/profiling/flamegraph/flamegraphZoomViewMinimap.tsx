import {Fragment, useCallback, useEffect, useMemo, useRef, useState} from 'react';
import styled from '@emotion/styled';
import * as Sentry from '@sentry/react';
import {vec2} from 'gl-matrix';

import {addErrorMessage} from 'sentry/actionCreators/indicator';
import {
  CanvasPoolManager,
  useCanvasScheduler,
} from 'sentry/utils/profiling/canvasScheduler';
import {CanvasView} from 'sentry/utils/profiling/canvasView';
import {Flamegraph} from 'sentry/utils/profiling/flamegraph';
import {useFlamegraphPreferences} from 'sentry/utils/profiling/flamegraph/hooks/useFlamegraphPreferences';
import {useFlamegraphTheme} from 'sentry/utils/profiling/flamegraph/useFlamegraphTheme';
import {FlamegraphCanvas} from 'sentry/utils/profiling/flamegraphCanvas';
import {
  getConfigSpaceTranslationBetweenVectors,
  getMinimapCanvasCursor,
  getPhysicalSpacePositionFromOffset,
  initializeFlamegraphRenderer,
} from 'sentry/utils/profiling/gl/utils';
import {FlamegraphRenderer2D} from 'sentry/utils/profiling/renderers/flamegraphRenderer2D';
import {FlamegraphRendererWebGL} from 'sentry/utils/profiling/renderers/flamegraphRendererWebGL';
import {PositionIndicatorRenderer} from 'sentry/utils/profiling/renderers/positionIndicatorRenderer';
import {Rect} from 'sentry/utils/profiling/speedscope';

import {useCanvasScroll} from './interactions/useCanvasScroll';
import {useCanvasZoomOrScroll} from './interactions/useCanvasZoomOrScroll';
import {useInteractionViewCheckPoint} from './interactions/useInteractionViewCheckPoint';
import {useWheelCenterZoom} from './interactions/useWheelCenterZoom';

interface FlamegraphZoomViewMinimapProps {
  canvasPoolManager: CanvasPoolManager;
  flamegraph: Flamegraph;
  flamegraphMiniMapCanvas: FlamegraphCanvas | null;
  flamegraphMiniMapCanvasRef: HTMLCanvasElement | null;
  flamegraphMiniMapOverlayCanvasRef: HTMLCanvasElement | null;
  flamegraphMiniMapView: CanvasView<Flamegraph> | null;
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
  const {colorCoding} = useFlamegraphPreferences();
  const [lastInteraction, setLastInteraction] = useState<
    'pan' | 'click' | 'zoom' | 'scroll' | 'select' | 'resize' | null
  >(null);

  const [startInteractionVector, setStartInteractionVector] = useState<vec2 | null>(null);
  const [lastDragVector, setLastDragVector] = useState<vec2 | null>(null);
  const [configSpaceCursor, setConfigSpaceCursor] = useState<vec2 | null>(null);
  const scheduler = useCanvasScheduler(canvasPoolManager);

  const miniMapConfigSpaceBorderSize = useMemo(() => {
    if (!flamegraphMiniMapView || !flamegraphMiniMapCanvas?.physicalSpace) {
      return 0;
    }
    // compute 10px in physical space to configSpace
    return new Rect(0, 0, 10, 0).transformRect(
      flamegraphMiniMapView.toConfigSpace(flamegraphMiniMapCanvas.physicalSpace)
    ).width;
  }, [flamegraphMiniMapView, flamegraphMiniMapCanvas?.physicalSpace]);

  const flamegraphMiniMapRenderer = useMemo(() => {
    if (!flamegraphMiniMapCanvasRef) {
      return null;
    }

    const renderer = initializeFlamegraphRenderer(
      [FlamegraphRendererWebGL, FlamegraphRenderer2D],
      [
        flamegraphMiniMapCanvasRef,
        flamegraph,
        flamegraphTheme,
        {colorCoding, draw_border: false},
      ]
    );

    if (renderer === null) {
      Sentry.captureException('Failed to initialize a flamegraph renderer');
      addErrorMessage('Failed to initialize renderer');
      return null;
    }

    return renderer;
  }, [flamegraph, flamegraphMiniMapCanvasRef, colorCoding, flamegraphTheme]);

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
      !positionIndicatorRenderer ||
      !flamegraphMiniMapRenderer
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

    const drawRectangles = () => {
      flamegraphMiniMapRenderer.draw(
        flamegraphMiniMapView.fromTransformedConfigSpace(
          flamegraphMiniMapCanvas.physicalSpace
        )
      );
    };

    scheduler.registerBeforeFrameCallback(clearOverlayCanvas);
    scheduler.registerBeforeFrameCallback(drawRectangles);
    scheduler.registerAfterFrameCallback(drawPosition);

    scheduler.draw();

    return () => {
      scheduler.unregisterBeforeFrameCallback(clearOverlayCanvas);
      scheduler.unregisterAfterFrameCallback(drawPosition);
      scheduler.unregisterBeforeFrameCallback(drawRectangles);
    };
  }, [
    flamegraphMiniMapCanvas,
    flamegraphMiniMapView,
    flamegraphMiniMapRenderer,
    scheduler,
    positionIndicatorRenderer,
  ]);

  useInteractionViewCheckPoint({
    view: flamegraphMiniMapView,
    lastInteraction,
  });

  const onMouseDrag = useCallback(
    (evt: React.MouseEvent<HTMLCanvasElement>) => {
      if (!lastDragVector || !flamegraphMiniMapCanvas || !flamegraphMiniMapView) {
        return;
      }

      const configDelta = getConfigSpaceTranslationBetweenVectors(
        evt.nativeEvent.offsetX,
        evt.nativeEvent.offsetY,
        lastDragVector,
        flamegraphMiniMapView,
        flamegraphMiniMapCanvas,
        true
      );

      if (!configDelta) {
        return;
      }

      canvasPoolManager.dispatch('transform config view', [
        configDelta,
        flamegraphMiniMapView,
      ]);
      setLastDragVector(
        getPhysicalSpacePositionFromOffset(
          evt.nativeEvent.offsetX,
          evt.nativeEvent.offsetY
        )
      );
    },
    [lastDragVector, flamegraphMiniMapCanvas, flamegraphMiniMapView, canvasPoolManager]
  );

  const prevConfigSpaceCursor = useRef<vec2 | null>(vec2.fromValues(0, 0));
  const onMinimapCanvasMouseMove = useCallback(
    (evt: React.MouseEvent<HTMLCanvasElement>) => {
      if (!flamegraphMiniMapCanvas || !flamegraphMiniMapView) {
        return;
      }

      const configSpaceMouse = flamegraphMiniMapView.getTransformedConfigSpaceCursor(
        vec2.fromValues(evt.nativeEvent.offsetX, evt.nativeEvent.offsetY),
        flamegraphMiniMapCanvas
      );

      setConfigSpaceCursor(configSpaceMouse);

      if (!prevConfigSpaceCursor.current) {
        return;
      }

      if (lastDragVector) {
        onMouseDrag(evt);
        setLastInteraction('pan');
        return;
      }

      if (lastInteraction === 'resize') {
        const configView = flamegraphMiniMapView.configView;

        const configViewCenter = configView.width / 2 + configView.x;
        const mouseX = configSpaceMouse[0];
        const dragDelta = prevConfigSpaceCursor.current
          ? configSpaceMouse[0] - prevConfigSpaceCursor.current[0]
          : 0;
        const x = mouseX < configViewCenter ? configSpaceMouse[0] : configView.left;
        const dragDirection = mouseX < configViewCenter ? -1 : 1;

        const rect = new Rect(
          x,
          configSpaceMouse[1] - flamegraphMiniMapView.configView.height / 2,
          configView.width + dragDelta * dragDirection,
          configView.height
        );

        canvasPoolManager.dispatch('set config view', [rect, flamegraphMiniMapView]);
        prevConfigSpaceCursor.current = configSpaceMouse;
        return;
      }

      if (startInteractionVector) {
        const start = vec2.min(
          vec2.create(),
          prevConfigSpaceCursor.current,
          configSpaceMouse
        );
        const end = vec2.max(
          vec2.create(),
          prevConfigSpaceCursor.current,
          configSpaceMouse
        );

        const rect = new Rect(
          start[0],
          configSpaceMouse[1] - flamegraphMiniMapView.configView.height / 2,
          end[0] - start[0],
          flamegraphMiniMapView.configView.height
        );

        canvasPoolManager.dispatch('set config view', [rect, flamegraphMiniMapView]);
        setLastInteraction('select');
        return;
      }

      prevConfigSpaceCursor.current = configSpaceMouse;
      setLastInteraction(null);
    },
    [
      flamegraphMiniMapCanvas,
      flamegraphMiniMapView,
      canvasPoolManager,
      lastDragVector,
      onMouseDrag,
      startInteractionVector,
      lastInteraction,
    ]
  );

  const onWheelCenterZoom = useWheelCenterZoom(
    flamegraphMiniMapCanvas,
    flamegraphMiniMapView,
    canvasPoolManager
  );

  const onCanvasScroll = useCanvasScroll(
    flamegraphMiniMapCanvas,
    flamegraphMiniMapView,
    canvasPoolManager
  );

  useCanvasZoomOrScroll({
    setConfigSpaceCursor,
    setLastInteraction,
    handleWheel: onWheelCenterZoom,
    handleScroll: onCanvasScroll,
    canvas: flamegraphMiniMapCanvasRef,
  });

  const onMinimapCanvasMouseDown = useCallback(
    (evt: React.MouseEvent<HTMLCanvasElement>) => {
      if (
        !configSpaceCursor ||
        !flamegraphMiniMapCanvas ||
        !flamegraphMiniMapView ||
        !canvasPoolManager
      ) {
        return;
      }

      if (
        miniMapConfigSpaceBorderSize >=
        Math.min(
          Math.abs(flamegraphMiniMapView.configView.left - configSpaceCursor[0]),
          Math.abs(flamegraphMiniMapView.configView.right - configSpaceCursor[0])
        )
      ) {
        setLastInteraction('resize');
        setStartInteractionVector(
          getPhysicalSpacePositionFromOffset(
            evt.nativeEvent.offsetX,
            evt.nativeEvent.offsetY
          )
        );
        return;
      }

      if (flamegraphMiniMapView.configView.contains(configSpaceCursor)) {
        setLastInteraction('pan');
        setLastDragVector(
          getPhysicalSpacePositionFromOffset(
            evt.nativeEvent.offsetX,
            evt.nativeEvent.offsetY
          )
        );
        return;
      }

      setLastInteraction('select');
      setStartInteractionVector(
        getPhysicalSpacePositionFromOffset(
          evt.nativeEvent.offsetX,
          evt.nativeEvent.offsetY
        )
      );
    },
    [
      configSpaceCursor,
      flamegraphMiniMapCanvas,
      flamegraphMiniMapView,
      canvasPoolManager,
      miniMapConfigSpaceBorderSize,
    ]
  );

  const onMinimapCanvasMouseUp = useCallback(() => {
    setConfigSpaceCursor(null);
    setStartInteractionVector(null);
    setLastInteraction(null);
    setLastDragVector(null);
  }, []);

  const onMinimapCanvasDoubleClick = useCallback(
    (evt: React.MouseEvent<HTMLCanvasElement>) => {
      if (!flamegraphMiniMapCanvas || !flamegraphMiniMapView || !canvasPoolManager) {
        return;
      }

      const configSpaceMouse = flamegraphMiniMapView.getTransformedConfigSpaceCursor(
        vec2.fromValues(evt.nativeEvent.offsetX, evt.nativeEvent.offsetY),
        flamegraphMiniMapCanvas
      );

      const view = new Rect(
        0,
        configSpaceMouse[1] - flamegraphMiniMapView.configView.height / 2,
        flamegraphMiniMapView.configSpace.width,
        flamegraphMiniMapView.configView.height
      );
      canvasPoolManager.dispatch('set config view', [view, flamegraphMiniMapView]);
    },
    [canvasPoolManager, flamegraphMiniMapCanvas, flamegraphMiniMapView]
  );

  useEffect(() => {
    window.addEventListener('mouseup', onMinimapCanvasMouseUp);

    return () => {
      window.removeEventListener('mouseup', onMinimapCanvasMouseUp);
    };
  }, [onMinimapCanvasMouseUp]);

  return (
    <Fragment>
      <Canvas
        ref={setFlamegraphMiniMapCanvasRef}
        onMouseDown={onMinimapCanvasMouseDown}
        onMouseMove={onMinimapCanvasMouseMove}
        onMouseLeave={onMinimapCanvasMouseUp}
        onDoubleClick={onMinimapCanvasDoubleClick}
        cursor={getMinimapCanvasCursor(
          flamegraphMiniMapView?.toOriginConfigView(flamegraphMiniMapView.configView),
          configSpaceCursor,
          miniMapConfigSpaceBorderSize
        )}
      />
      <OverlayCanvas ref={setFlamegraphMiniMapOverlayCanvasRef} />
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
