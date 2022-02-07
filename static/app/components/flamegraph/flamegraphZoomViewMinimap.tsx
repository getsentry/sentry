import * as React from 'react';
import {useCallback, useEffect, useMemo, useState} from 'react';
import styled from '@emotion/styled';
import {mat3, vec2} from 'gl-matrix';

import {CanvasPoolManager, CanvasScheduler} from 'sentry/utils/profiling/canvasScheduler';
import {Flamegraph} from 'sentry/utils/profiling/flamegraph';
import {FlamegraphTheme} from 'sentry/utils/profiling/flamegraph/FlamegraphTheme';
import {FlamegraphFrame} from 'sentry/utils/profiling/flamegraphFrame';
import {Rect, watchForResize} from 'sentry/utils/profiling/gl/utils';
import {FlamegraphRenderer} from 'sentry/utils/profiling/renderers/flamegraphRenderer';
import {PositionIndicatorRenderer} from 'sentry/utils/profiling/renderers/positionIndicatorRenderer';

type Props = {
  canvasPoolManager: CanvasPoolManager;
  flamegraph: Flamegraph;
  flamegraphTheme: FlamegraphTheme;
  colorCoding: 'by symbol name' | 'by system / application' | 'by library';
  highlightRecursion: boolean;
  height?: number;
};

function FlamegraphZoomViewMinimap({
  canvasPoolManager,
  flamegraph,
  flamegraphTheme,
  height = 100,
}: Props) {
  const [configSpaceCursor, setConfigSpaceCursor] = useState<[number, number] | null>(
    null
  );
  const [startDragVector, setStartDragConfigSpaceCursor] = useState<vec2 | null>(null);
  const [lastDragVector, setLastDragVector] = useState<vec2 | null>(null);

  const [minimapCanvasRef, setMinimapCanvasRef] = useState<HTMLCanvasElement | null>(
    null
  );
  const [minimapOverlayCanvasRef, setMinimapOverlayCanvasRef] =
    useState<HTMLCanvasElement | null>(null);

  const scheduler = useMemo(() => new CanvasScheduler(), []);

  const flamegraphRenderer = useMemo(() => {
    if (!minimapCanvasRef) {
      return null;
    }

    const BAR_HEIGHT =
      height / (flamegraph.depth + flamegraphTheme.SIZES.FLAMEGRAPH_DEPTH_OFFSET);

    const renderer = new FlamegraphRenderer(minimapCanvasRef, flamegraph, {
      ...flamegraphTheme,
      SIZES: {
        ...flamegraphTheme.SIZES,
        BAR_HEIGHT,
      },
    });

    return renderer;
  }, [canvasPoolManager, minimapCanvasRef, flamegraph, flamegraphTheme]);

  const positionIndicatorRenderer = useMemo(() => {
    if (!minimapOverlayCanvasRef) {
      return null;
    }

    const renderer = new PositionIndicatorRenderer(
      minimapOverlayCanvasRef,
      flamegraphTheme
    );
    return renderer;
  }, [minimapOverlayCanvasRef, flamegraph, flamegraphTheme]);

  useEffect(() => {
    if (!flamegraphRenderer || !positionIndicatorRenderer) {
      return () => {};
    }

    const clearOverlayCanvas = () =>
      positionIndicatorRenderer.context.clearRect(
        0,
        0,
        flamegraphRenderer.physicalSpace.width,
        flamegraphRenderer.physicalSpace.height
      );

    const drawRectangles = () =>
      flamegraphRenderer.draw(null, flamegraphRenderer.configSpaceToPhysicalSpace);

    const drawPosition = () => {};

    scheduler.registerBeforeFrameCallback(clearOverlayCanvas);
    scheduler.registerBeforeFrameCallback(drawRectangles);
    scheduler.registerAfterFrameCallback(drawPosition);

    scheduler.draw();

    return () => {
      scheduler.unregisterBeforeFrameCallback(clearOverlayCanvas);
      scheduler.unregisterBeforeFrameCallback(drawRectangles);
      scheduler.unregisterAfterFrameCallback(drawPosition);
    };
  }, [scheduler, flamegraphRenderer, positionIndicatorRenderer]);

  useEffect(() => {
    if (!flamegraphRenderer || !minimapCanvasRef || !minimapOverlayCanvasRef) {
      return () => {};
    }

    setConfigSpaceCursor(null);

    canvasPoolManager.registerScheduler(scheduler);

    const setConfigView = (rect: Rect) => {
      flamegraphRenderer.setConfigView(rect);
      scheduler.draw();
    };

    const transformConfigView = (mat: mat3) => {
      flamegraphRenderer.transformConfigView(mat);
      scheduler.draw();
    };

    const resetZoom = () => {
      flamegraphRenderer.setConfigView(
        flamegraph.inverted
          ? flamegraphRenderer.configView
              .translateY(
                flamegraphRenderer.configSpace.height -
                  flamegraphRenderer.configView.height +
                  1
              )
              .translateX(0)
              .withWidth(flamegraph.configSpace.width)
          : flamegraphRenderer.configView
              .translate(0, 0)
              .withWidth(flamegraph.configSpace.width)
      );
      setConfigSpaceCursor(null);
      scheduler.draw();
    };

    const zoomIntoFrame = (frame: FlamegraphFrame) => {
      flamegraphRenderer.setConfigView(
        new Rect(
          frame.start,
          flamegraph.inverted
            ? flamegraphRenderer.configSpace.height -
              flamegraphRenderer.configView.height -
              frame.depth +
              1
            : frame.depth,
          frame.end - frame.start,
          flamegraphRenderer.configView.height
        )
      );

      setConfigSpaceCursor(null);
      scheduler.draw();
    };

    const observer = watchForResize([minimapCanvasRef, minimapOverlayCanvasRef], () => {
      flamegraphRenderer.onResizeUpdateSpace();
      scheduler.drawSync();
    });

    scheduler.on('setConfigView', setConfigView);
    scheduler.on('transformConfigView', transformConfigView);
    scheduler.on('resetZoom', resetZoom);
    scheduler.on('zoomIntoFrame', zoomIntoFrame);

    return () => {
      observer.disconnect();
      canvasPoolManager.unregisterScheduler(scheduler);
      scheduler.off('setConfigView', setConfigView);
      scheduler.off('transformConfigView', transformConfigView);
      scheduler.off('resetZoom', resetZoom);
      scheduler.off('zoomIntoFrame', zoomIntoFrame);
    };
  }, [scheduler, flamegraphRenderer, minimapCanvasRef, minimapOverlayCanvasRef]);

  useEffect(() => {
    window.addEventListener('mouseup', () => {
      setLastDragVector(null);
      setStartDragConfigSpaceCursor(null);
    });
  }, []);

  const onMouseDrag = useCallback(
    (evt: React.MouseEvent<HTMLCanvasElement>) => {
      if (!lastDragVector || !flamegraphRenderer) {
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
        flamegraphRenderer.configSpaceToPhysicalSpace
      );

      const configDelta = vec2.transformMat3(
        vec2.create(),
        physicalDelta,
        physicalToConfig
      );

      const translate = mat3.fromTranslation(mat3.create(), configDelta);
      canvasPoolManager.dispatch('transformConfigView', [translate]);

      setLastDragVector(physicalMousePos);
    },
    [flamegraphRenderer, lastDragVector, canvasPoolManager]
  );

  const onMinimapCanvasMouseMove = useCallback(
    (evt: React.MouseEvent<HTMLCanvasElement>) => {
      if (!flamegraphRenderer || !flamegraphRenderer.frames.length) {
        return;
      }

      const configSpaceMouse = flamegraphRenderer.getConfigSpaceCursor(
        vec2.fromValues(evt.nativeEvent.offsetX, evt.nativeEvent.offsetY),
        flamegraphRenderer.configSpaceToPhysicalSpace
      );

      setConfigSpaceCursor([configSpaceMouse[0], configSpaceMouse[1]]);

      if (lastDragVector) {
        onMouseDrag(evt);
        return;
      }

      if (startDragVector) {
        const _start = vec2.min(vec2.create(), startDragVector, configSpaceMouse);
        const _end = vec2.max(vec2.create(), startDragVector, configSpaceMouse);

        // const rect = new Rect(
        //   start[0],
        //   configSpaceMouse[1] - canvasPoolManager.flamegraphRenderer?.configView.height / 2,
        //   end[0] - start[0],
        //   canvasPoolManager.flamegraphRenderer?.configView.height,
        // )
        // canvasPoolManager.setConfigView(rect)
      }
    },
    [canvasPoolManager, flamegraphRenderer, lastDragVector, onMouseDrag, startDragVector]
  );

  const onMinimapScroll = useCallback(
    (evt: WheelEvent) => {
      if (!flamegraphRenderer || flamegraphRenderer.frames.length) {
        return;
      }

      const physicalDelta = vec2.fromValues(evt.deltaX * 0.8, evt.deltaY);
      const physicalToConfig = mat3.invert(
        mat3.create(),
        flamegraphRenderer.configSpaceToPhysicalSpace
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
    },
    [flamegraphRenderer, canvasPoolManager]
  );

  const onMinimapZoom = useCallback(
    (evt: WheelEvent) => {
      if (!flamegraphRenderer || !flamegraphRenderer.frames.length) {
        return;
      }

      const identity = mat3.identity(mat3.create());
      const scale = 1 - evt.deltaY * 0.001 * -1; // -1 to invert scale

      const mouseInConfigSpace = flamegraphRenderer.getConfigSpaceCursor(
        vec2.fromValues(evt.offsetX, evt.offsetY),
        flamegraphRenderer.configSpaceToPhysicalSpace
      );

      const configCenter = vec2.fromValues(
        mouseInConfigSpace[0],
        flamegraphRenderer.configView.y
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
    [flamegraphRenderer, canvasPoolManager]
  );

  const onMinimapCanvasMouseDown = useCallback(
    _evt => {
      if (!configSpaceCursor || !flamegraphRenderer || !canvasPoolManager) {
        return;
      }

      // const logicalMousePos = vec2.fromValues(
      //   evt.nativeEvent.offsetX,
      //   evt.nativeEvent.offsetY
      // );
      // const physicalMousePos = vec2.scale(
      //   vec2.create(),
      //   logicalMousePos,
      //   window.devicePixelRatio
      // );

      // if (
      //   canvasPoolManager.flamegraphRenderer.configView.contains(
      //     vec2.fromValues(...configSpaceCursor),
      //   )
      // ) {
      //   setLastDragVector(physicalMousePos)
      // } else {
      //   const configSpaceCursor = flamegraphMiniMapRenderer.getConfigSpaceCursor(
      //     vec2.fromValues(evt.nativeEvent.offsetX, evt.nativeEvent.offsetY),
      //     flamegraphMiniMapRenderer.configSpaceToPhysicalSpace,
      //   )
      //   setStartDragConfigSpaceCursor(configSpaceCursor)
      // }
    },
    [configSpaceCursor, flamegraphRenderer, canvasPoolManager]
  );

  const onMinimapCanvasMouseUp = useCallback(() => {
    setConfigSpaceCursor(null);
    setStartDragConfigSpaceCursor(null);
    setLastDragVector(null);
  }, []);

  useEffect(() => {
    if (!minimapCanvasRef) {
      return () => {};
    }

    const onCanvasWheel = (evt: WheelEvent) => {
      evt.preventDefault();

      const isZoom = evt.metaKey;

      if (isZoom) {
        onMinimapZoom(evt);
      } else {
        onMinimapScroll(evt);
      }
    };

    minimapCanvasRef.addEventListener('wheel', onCanvasWheel);

    return () => minimapCanvasRef?.removeEventListener('wheel', onCanvasWheel);
  }, [minimapCanvasRef, onMinimapScroll, onMinimapZoom]);

  return (
    <MinimapWrapper>
      <MinimapCanvas
        ref={setMinimapCanvasRef}
        onMouseDown={onMinimapCanvasMouseDown}
        onMouseMove={onMinimapCanvasMouseMove}
        onMouseLeave={onMinimapCanvasMouseUp}
        cursor="grab"
      />
      <MinimapOverlayCanvas ref={setMinimapOverlayCanvasRef} />
    </MinimapWrapper>
  );
}

const MinimapWrapper = styled('div')`
  position: relative;
  height: 100%;
`;

const BaseCanvas = styled('canvas')`
  width: 100%;
  height: 100%;
  left: 0px;
  right: 0px;
  position: absolute;
`;

const MinimapCanvas = styled(BaseCanvas)<{cursor: 'grab' | 'col-resize'}>`
  user-select: none;
  cursor: ${p => p.cursor};
`;

const MinimapOverlayCanvas = styled(BaseCanvas)`
  pointer-events: none;
`;

export {FlamegraphZoomViewMinimap};
