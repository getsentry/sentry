import React, {useCallback, useEffect, useMemo, useState} from 'react';
import styled from '@emotion/styled';
import {mat3, vec2} from 'gl-matrix';

import {CanvasPoolManager, CanvasScheduler} from 'sentry/utils/profiling/canvasScheduler';
import {Flamegraph} from 'sentry/utils/profiling/flamegraph';
import {useFlamegraphPreferencesValue} from 'sentry/utils/profiling/flamegraph/useFlamegraphPreferences';
import {useFlamegraphTheme} from 'sentry/utils/profiling/flamegraph/useFlamegraphTheme';
import {FlamegraphFrame} from 'sentry/utils/profiling/flamegraphFrame';
import {Rect, watchForResize} from 'sentry/utils/profiling/gl/utils';
import {FlamegraphRenderer} from 'sentry/utils/profiling/renderers/flamegraphRenderer';
import {PositionIndicatorRenderer} from 'sentry/utils/profiling/renderers/positionIndicatorRenderer';
import {useMemoWithPrevious} from 'sentry/utils/useMemoWithPrevious';

interface FlamegraphZoomViewMinimapProps {
  canvasPoolManager: CanvasPoolManager;
  flamegraph: Flamegraph;
}

function FlamegraphZoomViewMinimap({
  canvasPoolManager,
  flamegraph,
}: FlamegraphZoomViewMinimapProps): React.ReactElement {
  const flamegraphPreferences = useFlamegraphPreferencesValue();
  const flamegraphTheme = useFlamegraphTheme();

  const [flamegraphMiniMapCanvasRef, setFlamegraphMiniMapRef] =
    useState<HTMLCanvasElement | null>(null);
  const [flamegraphMiniMapOverlayCanvasRef, setFlamegraphMiniMapOverlayCanvasRef] =
    useState<HTMLCanvasElement | null>(null);
  const [configSpaceCursor, setConfigSpaceCursor] = useState<[number, number] | null>(
    null
  );

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

      if (previousRenderer?.flamegraph.name === renderer.flamegraph.name) {
        renderer.setConfigView(previousRenderer.configView);
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
        flamegraphMiniMapRenderer.physicalSpace.width,
        flamegraphMiniMapRenderer.physicalSpace.height
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

    const onZoomIntoFrame = (frame: FlamegraphFrame) => {
      flamegraphMiniMapRenderer.setConfigView(
        new Rect(
          frame.start,
          flamegraph.inverted
            ? flamegraphMiniMapRenderer.configSpace.height -
              flamegraphMiniMapRenderer.configView.height -
              frame.depth +
              1
            : frame.depth,
          frame.end - frame.start,
          flamegraphMiniMapRenderer.configView.height
        )
      );

      setConfigSpaceCursor(null);
      scheduler.draw();
    };

    const onResetZoom = () => {
      flamegraphMiniMapRenderer.setConfigView(
        flamegraph.inverted
          ? flamegraphMiniMapRenderer.configView
              .translateY(
                flamegraphMiniMapRenderer.configSpace.height -
                  flamegraphMiniMapRenderer.configView.height +
                  1
              )
              .translateX(0)
              .withWidth(flamegraph.configSpace.width)
          : flamegraphMiniMapRenderer.configView
              .translate(0, 0)
              .withWidth(flamegraph.configSpace.width)
      );
      setConfigSpaceCursor(null);
      scheduler.draw();
    };

    scheduler.on('setConfigView', onConfigViewChange);
    scheduler.on('transformConfigView', onTransformConfigView);
    scheduler.on('zoomIntoFrame', onZoomIntoFrame);
    scheduler.on('resetZoom', onResetZoom);

    return () => {
      scheduler.off('setConfigView', onConfigViewChange);
      scheduler.off('transformConfigView', onTransformConfigView);
      scheduler.off('zoomIntoFrame', onZoomIntoFrame);
      scheduler.off('resetZoom', onResetZoom);
    };
  }, [scheduler, flamegraphMiniMapRenderer]);

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
  }, [scheduler]);

  useEffect(() => {
    window.addEventListener('mouseup', () => {
      setLastDragVector(null);
      setStartDragConfigSpaceCursor(null);
    });
  }, []);

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

      setConfigSpaceCursor([configSpaceMouse[0], configSpaceMouse[1]]);

      if (lastDragVector) {
        onMouseDrag(evt);
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
      }
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

      if (
        flamegraphMiniMapRenderer.configView.contains(
          vec2.fromValues(...configSpaceCursor)
        )
      ) {
        setLastDragVector(physicalMousePos);
      } else {
        const startConfigSpaceCursor = flamegraphMiniMapRenderer.getConfigSpaceCursor(
          vec2.fromValues(evt.nativeEvent.offsetX, evt.nativeEvent.offsetY),
          flamegraphMiniMapRenderer.configSpaceToPhysicalSpace
        );
        setStartDragConfigSpaceCursor(startConfigSpaceCursor);
      }
    },
    [configSpaceCursor, flamegraphMiniMapRenderer, canvasPoolManager]
  );

  const onMinimapCanvasMouseUp = useCallback(() => {
    setConfigSpaceCursor(null);
    setStartDragConfigSpaceCursor(null);
    setLastDragVector(null);
  }, []);

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
    <React.Fragment>
      <Canvas
        ref={canvas => setFlamegraphMiniMapRef(canvas)}
        onMouseDown={onMinimapCanvasMouseDown}
        onMouseMove={onMinimapCanvasMouseMove}
        onMouseLeave={onMinimapCanvasMouseUp}
        cursor={
          configSpaceCursor &&
          flamegraphMiniMapRenderer?.configView.contains(
            vec2.fromValues(...configSpaceCursor)
          )
            ? 'grab'
            : 'col-resize'
        }
        style={{
          userSelect: 'none',
        }}
      />
      <OverlayCanvas ref={canvas => setFlamegraphMiniMapOverlayCanvasRef(canvas)} />
    </React.Fragment>
  );
}

const Canvas = styled('canvas')<{cursor?: React.CSSProperties['cursor']}>`
  width: 100%;
  height: 100%;
  position: absolute;
  left: 0;
  top: 0;
  cursor: ${props => props.cursor ?? 'default'};
`;

const OverlayCanvas = styled(Canvas)`
  pointer-events: none;
`;

export {FlamegraphZoomViewMinimap};
