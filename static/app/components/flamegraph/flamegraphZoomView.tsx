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
import {GridRenderer} from 'sentry/utils/profiling/renderers/gridRenderer';
import {SelectedFrameRenderer} from 'sentry/utils/profiling/renderers/selectedFrameRenderer';
import {TextRenderer} from 'sentry/utils/profiling/renderers/textRenderer';

type Props = {
  canvasPoolManager: CanvasPoolManager;
  flamegraph: Flamegraph;
  flamegraphTheme: FlamegraphTheme;
};

function FlamegraphZoomView({canvasPoolManager, flamegraph, flamegraphTheme}: Props) {
  const [configSpaceCursor, setConfigSpaceCursor] = useState<[number, number] | null>(
    null
  );
  const [selectedNode, setSelectedNode] = useState<FlamegraphFrame | null>(null);

  const [flamegraphCanvasRef, setFlamegraphCanvasRef] =
    useState<HTMLCanvasElement | null>(null);
  const [flamegraphOverlayCanvasRef, setFlamegraphOverlayCanvasRef] =
    useState<HTMLCanvasElement | null>(null);

  const scheduler = useMemo(() => new CanvasScheduler(), []);

  const flamegraphRenderer = useMemo(() => {
    if (!flamegraphCanvasRef) {
      return null;
    }

    const renderer = new FlamegraphRenderer(
      flamegraphCanvasRef,
      flamegraph,
      flamegraphTheme,
      flamegraph.inverted
        ? vec2.fromValues(0, 0)
        : vec2.fromValues(
            0,
            flamegraphTheme.SIZES.TIMELINE_HEIGHT * window.devicePixelRatio
          ),
      {draw_border: true}
    );

    if (flamegraph.inverted) {
      const configView = renderer.configView.translateY(
        renderer.configSpace.height - renderer.configView.height + 1
      );
      canvasPoolManager.dispatch('setConfigView', [configView]);
    }

    return renderer;
  }, [canvasPoolManager, flamegraphCanvasRef, flamegraph, flamegraphTheme]);

  const textRenderer = useMemo(() => {
    if (!flamegraphOverlayCanvasRef) {
      return null;
    }

    const renderer = new TextRenderer(
      flamegraphOverlayCanvasRef,
      flamegraph,
      flamegraphTheme
    );

    return renderer;
  }, [flamegraphOverlayCanvasRef, flamegraph, flamegraphTheme]);

  const gridRenderer = useMemo(() => {
    if (!flamegraphOverlayCanvasRef) {
      return null;
    }

    const renderer = new GridRenderer(
      flamegraphOverlayCanvasRef,
      flamegraphTheme,
      flamegraph.formatter
    );

    return renderer;
  }, [flamegraphOverlayCanvasRef, flamegraph, flamegraphTheme]);

  const selectedFrameRenderer = useMemo(() => {
    if (!flamegraphOverlayCanvasRef) {
      return null;
    }
    return new SelectedFrameRenderer(flamegraphOverlayCanvasRef);
  }, [flamegraphOverlayCanvasRef]);

  const hoveredNode = useMemo(() => {
    if (!configSpaceCursor || !flamegraphRenderer) {
      return null;
    }
    return flamegraphRenderer.getHoveredNode(configSpaceCursor);
  }, [configSpaceCursor, flamegraphRenderer]);

  useEffect(() => {
    if (
      !scheduler ||
      !flamegraphRenderer ||
      !textRenderer ||
      !gridRenderer ||
      !selectedFrameRenderer
    ) {
      return () => {};
    }

    const clearOverlayCanvas = () =>
      textRenderer.context.clearRect(
        0,
        0,
        flamegraphRenderer.physicalSpace.width,
        flamegraphRenderer.physicalSpace.height
      );

    const drawSelectedFrame = () => {
      if (!selectedNode && !hoveredNode) {
        return;
      }

      if (selectedNode) {
        selectedFrameRenderer.draw(
          new Rect(
            selectedNode.start,
            flamegraph.inverted
              ? flamegraphRenderer.configSpace.height - selectedNode.depth
              : selectedNode.depth,
            selectedNode.end - selectedNode.start,
            1
          ),
          {
            BORDER_COLOR: flamegraphRenderer.theme.COLORS.SELECTED_FRAME_BORDER_COLOR,
            BORDER_WIDTH: flamegraphRenderer.theme.SIZES.FRAME_BORDER_WIDTH,
          },
          selectedFrameRenderer.context,
          flamegraphRenderer.configToPhysicalSpace
        );
      }

      if (hoveredNode && selectedNode !== hoveredNode) {
        selectedFrameRenderer.draw(
          new Rect(
            hoveredNode.start,
            flamegraph.inverted
              ? flamegraphRenderer.configSpace.height - hoveredNode.depth
              : hoveredNode.depth,
            hoveredNode.end - hoveredNode.start,
            1
          ),
          {
            BORDER_COLOR: flamegraphRenderer.theme.COLORS.HOVERED_FRAME_BORDER_COLOR,
            BORDER_WIDTH: flamegraphRenderer.theme.SIZES.HOVERED_FRAME_BORDER_WIDTH,
          },
          selectedFrameRenderer.context,
          flamegraphRenderer.configToPhysicalSpace
        );
      }
    };

    const drawText = () =>
      textRenderer.draw(
        flamegraphRenderer.configView,
        flamegraphRenderer.configSpace,
        flamegraphRenderer.configToPhysicalSpace
      );

    const drawGrid = () =>
      gridRenderer.draw(
        flamegraphRenderer.configView,
        flamegraphRenderer.physicalSpace,
        flamegraphRenderer.configToPhysicalSpace
      );

    // TODO: add support for search results
    const drawRectangles = () => flamegraphRenderer.draw(null);

    scheduler.registerBeforeFrameCallback(clearOverlayCanvas);
    scheduler.registerBeforeFrameCallback(drawSelectedFrame);
    scheduler.registerBeforeFrameCallback(drawText);
    scheduler.registerBeforeFrameCallback(drawGrid);
    scheduler.registerBeforeFrameCallback(drawRectangles);

    scheduler.draw();

    return () => {
      scheduler.unregisterBeforeFrameCallback(clearOverlayCanvas);
      scheduler.unregisterBeforeFrameCallback(drawSelectedFrame);
      scheduler.unregisterBeforeFrameCallback(drawText);
      scheduler.unregisterBeforeFrameCallback(drawGrid);
      scheduler.unregisterBeforeFrameCallback(drawRectangles);
    };
  }, [
    canvasPoolManager,
    scheduler,
    flamegraph,
    flamegraphTheme,
    flamegraphRenderer,
    textRenderer,
    gridRenderer,
    selectedFrameRenderer,
    selectedNode,
    hoveredNode,
  ]);

  useEffect(() => {
    if (!flamegraphRenderer || !flamegraphCanvasRef || !flamegraphOverlayCanvasRef) {
      return () => {};
    }

    setConfigSpaceCursor(null);
    setSelectedNode(null);

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
      // if (
      //   flamegraph.profile.frameIndex[frame.frame.key] &&
      //   flamegraph.profile.frameIndex[frame.frame.key].name !== frame.frame.name
      // )
      //   return

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
      setSelectedNode(frame);
      setConfigSpaceCursor(null);
      scheduler.draw();
    };

    scheduler.on('setConfigView', setConfigView);
    scheduler.on('transformConfigView', transformConfigView);
    scheduler.on('resetZoom', resetZoom);
    scheduler.on('zoomIntoFrame', zoomIntoFrame);

    const observer = watchForResize(
      [flamegraphCanvasRef, flamegraphOverlayCanvasRef],
      () => {
        flamegraphRenderer.onResizeUpdateSpace();

        canvasPoolManager.dispatch('setConfigView', [flamegraphRenderer.configView]);
        scheduler.drawSync();
      }
    );

    return () => {
      observer.disconnect();
      canvasPoolManager.unregisterScheduler(scheduler);
      scheduler.off('setConfigView', setConfigView);
      scheduler.off('transformConfigView', transformConfigView);
      scheduler.off('resetZoom', resetZoom);
      scheduler.off('zoomIntoFrame', zoomIntoFrame);
    };
  }, [
    canvasPoolManager,
    flamegraph,
    flamegraphRenderer,
    flamegraphCanvasRef,
    flamegraphOverlayCanvasRef,
  ]);

  const onCanvasClick = useCallback(
    (evt: React.MouseEvent<HTMLCanvasElement>) => {
      evt.preventDefault();
      evt.stopPropagation();

      if (!flamegraphRenderer || !configSpaceCursor) {
        return;
      }

      if (hoveredNode && selectedNode && hoveredNode === selectedNode) {
        canvasPoolManager.dispatch('zoomIntoFrame', [hoveredNode]);
      }

      setSelectedNode(hoveredNode);
    },
    [flamegraphRenderer, configSpaceCursor, selectedNode, canvasPoolManager]
  );

  const onCanvasMouseMove = useCallback(
    (evt: React.MouseEvent<HTMLCanvasElement>) => {
      if (!flamegraphRenderer || !flamegraphRenderer.frames.length) {
        return;
      }

      const configSpaceMouse = flamegraphRenderer.getConfigSpaceCursor(
        vec2.fromValues(evt.nativeEvent.offsetX, evt.nativeEvent.offsetY)
      );

      setConfigSpaceCursor([configSpaceMouse[0], configSpaceMouse[1]]);
    },
    [flamegraphRenderer, setConfigSpaceCursor]
  );

  const zoomHandler = useCallback(
    (evt: WheelEvent) => {
      if (!flamegraphRenderer || !flamegraphRenderer.frames.length) {
        return;
      }

      const identity = mat3.identity(mat3.create());
      const scale = 1 - evt.deltaY * 0.01 * -1; // -1 to invert scale

      const mouseInConfigSpace = flamegraphRenderer.getConfigSpaceCursor(
        vec2.fromValues(evt.offsetX, evt.offsetY)
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
    [canvasPoolManager, flamegraphRenderer]
  );

  const scrollHandler = useCallback(
    (evt: WheelEvent) => {
      if (!flamegraphRenderer || !flamegraphRenderer.frames.length) {
        return;
      }

      const physicalDelta = vec2.fromValues(evt.deltaX, evt.deltaY);
      const physicalToConfig = mat3.invert(
        mat3.create(),
        flamegraphRenderer.configToPhysicalSpace
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
    [canvasPoolManager, flamegraphRenderer]
  );

  useEffect(() => {
    if (!flamegraphCanvasRef) {
      return () => {};
    }

    const onCanvasWheel = (evt: WheelEvent) => {
      evt.preventDefault();
      setConfigSpaceCursor(null);

      const isZoom = evt.metaKey;

      if (isZoom) {
        zoomHandler(evt);
      } else {
        scrollHandler(evt);
      }
    };

    flamegraphCanvasRef.addEventListener('wheel', onCanvasWheel);
    return () => flamegraphCanvasRef?.removeEventListener('wheel', onCanvasWheel);
  }, [flamegraphCanvasRef, zoomHandler, scrollHandler]);

  return (
    <FlamegraphWrapper>
      <FlamegraphCanvas
        ref={setFlamegraphCanvasRef}
        onClick={onCanvasClick}
        onMouseMove={onCanvasMouseMove}
        onMouseLeave={() => setConfigSpaceCursor(null)}
      />
      <FlamegraphOverlayCanvas ref={setFlamegraphOverlayCanvasRef} />
    </FlamegraphWrapper>
  );
}

const FlamegraphWrapper = styled('div')`
  position: relative;
  height: 100%;
`;

const BaseCanvas = styled('canvas')`
  width: 100%;
  height: 100%;
  left: 0px;
  right: 0px;
  user-select: none;
  position: absolute;
`;

const FlamegraphCanvas = styled(BaseCanvas)``;

const FlamegraphOverlayCanvas = styled(BaseCanvas)`
  pointer-events: none;
`;

export {FlamegraphZoomView};
