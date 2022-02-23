import * as React from 'react';
import styled from '@emotion/styled';
import {mat3, vec2} from 'gl-matrix';

import {CanvasPoolManager, CanvasScheduler} from 'sentry/utils/profiling/canvasScheduler';
import {Flamegraph} from 'sentry/utils/profiling/flamegraph';
import {FlamegraphPreferences} from 'sentry/utils/profiling/flamegraph/useFlamegraphPreferences';
import {useFlamegraphTheme} from 'sentry/utils/profiling/flamegraph/useFlamegraphTheme';
import {FlamegraphFrame} from 'sentry/utils/profiling/flamegraphFrame';
import {Rect, watchForResize} from 'sentry/utils/profiling/gl/utils';
import {FlamegraphRenderer} from 'sentry/utils/profiling/renderers/flamegraphRenderer';
import {PositionIndicatorRenderer} from 'sentry/utils/profiling/renderers/positionIndicatorRenderer';
import {useMemoWithPrevious} from 'sentry/utils/useMemoWithPrevious';

interface FlamegraphZoomViewMinimapProps {
  canvasPoolManager: CanvasPoolManager;
  colorCoding: FlamegraphPreferences['colorCoding'];
  flamegraph: Flamegraph;
}

function FlamegraphZoomViewMinimap({
  canvasPoolManager,
  flamegraph,
  colorCoding,
}: FlamegraphZoomViewMinimapProps): React.ReactElement {
  const [flamegraphMiniMapCanvasRef, setFlamegraphMiniMapRef] =
    React.useState<HTMLCanvasElement | null>(null);
  const [flamegraphMiniMapOverlayCanvasRef, setFlamegraphMiniMapOverlayCanvasRef] =
    React.useState<HTMLCanvasElement | null>(null);
  const [configSpaceCursor, setConfigSpaceCursor] = React.useState<
    [number, number] | null
  >(null);

  const flamegraphTheme = useFlamegraphTheme();

  const flamegraphMiniMapRenderer = useMemoWithPrevious<FlamegraphRenderer | null>(
    previousRenderer => {
      if (!flamegraphMiniMapCanvasRef) {
        return null;
      }

      const BAR_HEIGHT =
        flamegraphTheme.SIZES.TIMELINE_HEIGHT /
        (flamegraph.depth + flamegraphTheme.SIZES.FLAMEGRAPH_DEPTH_OFFSET);

      const flamegraphMinimapRenderer = new FlamegraphRenderer(
        flamegraphMiniMapCanvasRef,
        flamegraph,
        {
          ...flamegraphTheme,
          SIZES: {
            ...flamegraphTheme.SIZES,
            BAR_HEIGHT,
          },
        }
      );

      if (
        previousRenderer?.flamegraph.name === flamegraphMinimapRenderer.flamegraph.name
      ) {
        flamegraphMinimapRenderer.setConfigView(previousRenderer.configView);
      }

      return flamegraphMinimapRenderer;
    },
    [flamegraphMiniMapCanvasRef, flamegraph, flamegraphTheme, colorCoding]
  );

  const [startDragVector, setStartDragConfigSpaceCursor] = React.useState<vec2 | null>(
    null
  );
  const [lastDragVector, setLastDragVector] = React.useState<vec2 | null>(null);

  React.useEffect(() => {
    if (
      !flamegraphMiniMapCanvasRef ||
      !flamegraphMiniMapOverlayCanvasRef ||
      !flamegraphMiniMapRenderer
    ) {
      return undefined;
    }

    const scheduler = new CanvasScheduler();

    const positionIndicatorRenderer = new PositionIndicatorRenderer(
      flamegraphMiniMapOverlayCanvasRef,
      flamegraphTheme
    );

    const drawRectangles = () => {
      flamegraphMiniMapRenderer.draw(
        null,
        flamegraphMiniMapRenderer.configSpaceToPhysicalSpace
      );
    };

    const drawPosition = () => {
      positionIndicatorRenderer.draw(
        flamegraphMiniMapRenderer.configView,
        flamegraphMiniMapRenderer.configSpace,
        flamegraphMiniMapRenderer.configSpaceToPhysicalSpace
      );
    };

    const clearOverlayCanvas = () => {
      positionIndicatorRenderer.context.clearRect(
        0,
        0,
        flamegraphMiniMapRenderer.physicalSpace.width,
        flamegraphMiniMapRenderer.physicalSpace.height
      );
    };

    const onConfigViewChange = (rect: Rect) => {
      flamegraphMiniMapRenderer.setConfigView(rect);
      scheduler.draw();
    };

    const onTransformConfigView = (mat: mat3) => {
      flamegraphMiniMapRenderer.transformConfigView(mat);
      scheduler.draw();
    };

    scheduler.on('setConfigView', onConfigViewChange);
    scheduler.on('transformConfigView', onTransformConfigView);
    scheduler.on('zoomIntoFrame', (frame: FlamegraphFrame) => {
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
    });
    scheduler.on('resetZoom', () => {
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
    });

    scheduler.registerBeforeFrameCallback(drawRectangles);
    scheduler.registerBeforeFrameCallback(clearOverlayCanvas);
    scheduler.registerAfterFrameCallback(drawPosition);

    const observer = watchForResize(
      [flamegraphMiniMapCanvasRef, flamegraphMiniMapOverlayCanvasRef],
      () => {
        flamegraphMiniMapRenderer.onResizeUpdateSpace();
        scheduler.drawSync();
      }
    );

    canvasPoolManager.registerScheduler(scheduler);

    return () => {
      observer.disconnect();
      canvasPoolManager.unregisterScheduler(scheduler);
    };
  }, [
    canvasPoolManager,
    flamegraph,
    flamegraphTheme,
    flamegraphMiniMapRenderer,
    flamegraphMiniMapCanvasRef,
    flamegraphMiniMapOverlayCanvasRef,
  ]);

  React.useEffect(() => {
    window.addEventListener('mouseup', () => {
      setLastDragVector(null);
      setStartDragConfigSpaceCursor(null);
    });
  }, []);

  const onMouseDrag = React.useCallback(
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

  const onMinimapCanvasMouseMove = React.useCallback(
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

  const onMinimapScroll = React.useCallback(
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

  const onMinimapZoom = React.useCallback(
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

  const onMinimapCanvasMouseDown = React.useCallback(
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

  const onMinimapCanvasMouseUp = React.useCallback(() => {
    setConfigSpaceCursor(null);
    setStartDragConfigSpaceCursor(null);
    setLastDragVector(null);
  }, []);

  React.useEffect(() => {
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
