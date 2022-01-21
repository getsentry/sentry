import * as React from 'react';
import {useCallback, useEffect, useMemo, useState} from 'react';
import {mat3, vec2} from 'gl-matrix';

import {CanvasPoolManager, CanvasScheduler} from 'sentry/utils/profiling/canvasScheduler';
import {DifferentialFlamegraph} from 'sentry/utils/profiling/differentialFlamegraph';
import {Flamegraph} from 'sentry/utils/profiling/flamegraph';
import {FlamegraphTheme} from 'sentry/utils/profiling/flamegraph/FlamegraphTheme';
import {FlamegraphFrame} from 'sentry/utils/profiling/flamegraphFrame';
import {Rect, watchForResize} from 'sentry/utils/profiling/gl/utils';
import {FlamegraphRenderer} from 'sentry/utils/profiling/renderers/flamegraphRenderer';
import {SelectedFrameRenderer} from 'sentry/utils/profiling/renderers/selectedFrameRenderer';
import {TextRenderer} from 'sentry/utils/profiling/renderers/textRenderer';

interface FlamegraphZoomViewProps {
  canvasPoolManager: CanvasPoolManager;
  flamegraph: Flamegraph | DifferentialFlamegraph;
  colorCoding: 'by symbol name' | 'by system / application' | 'by library';
  searchResults: Record<string, FlamegraphFrame>;
  highlightRecursion: boolean;
  flamegraphTheme: FlamegraphTheme;
  showSelectedNodeStack?: boolean;
}

function FlamegraphZoomView({
  flamegraph,
  canvasPoolManager,
  colorCoding,
  searchResults,
  flamegraphTheme,
  highlightRecursion,
}: FlamegraphZoomViewProps) {
  const [scheduler, setScheduler] = useState<CanvasScheduler | null>(null);
  const [flamegraphCanvasRef, setFlamegraphCanvasRef] =
    useState<HTMLCanvasElement | null>(null);
  const [flamegraphOverlayCanvasRef, setFlamegraphOverlayCanvasRef] =
    useState<HTMLCanvasElement | null>(null);

  const [textRenderer, setTextRenderer] = useState<TextRenderer | null>();

  const flamegraphRenderer = useMemoWithPrevious<FlamegraphRenderer | null>(
    previousRenderer => {
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
        canvasPoolManager.dispatch('setConfigView', [
          renderer.configView.translateY(
            renderer.configSpace.height - renderer.configView.height + 1
          ),
        ]);
      }

      if (previousRenderer?.flamegraph.name === renderer.flamegraph.name) {
        renderer.setConfigView(previousRenderer.configView);
      }
      return renderer;
    },
    [
      flamegraphCanvasRef,
      flamegraphTheme,
      flamegraph,
      canvasPoolManager,
      colorCoding,
      highlightRecursion,
    ]
  );

  useEffect(() => {
    if (!flamegraphCanvasRef || !flamegraphOverlayCanvasRef || !flamegraphRenderer) {
      return;
    }

    const textRenderer = new TextRenderer(
      flamegraphOverlayCanvasRef,
      flamegraph,
      flamegraphTheme
    );

    const scheduler = new CanvasScheduler();

    setSelectedNode(null);
    setConfigSpaceCursor(null);
    setScheduler(scheduler);
    setTextRenderer(textRenderer);

    function clearOverlayCanvas() {
      textRenderer.context.clearRect(
        0,
        0,
        flamegraphRenderer.physicalSpace.width,
        flamegraphRenderer.physicalSpace.height
      );
    }

    function drawText() {
      textRenderer.draw(
        flamegraphRenderer.configView,
        flamegraphRenderer.configSpace,
        flamegraphRenderer.configToPhysicalSpace
      );
    }

    function drawRectangles() {
      flamegraphRenderer.draw(searchResults);
    }

    function onConfigViewChange(rect: Rect) {
      flamegraphRenderer.setConfigView(rect);
      scheduler.draw();
    }

    function onTransformConfigView(mat: mat3) {
      flamegraphRenderer.transformConfigView(mat);
      scheduler.draw();
    }

    scheduler.on('setConfigView', onConfigViewChange);
    scheduler.on('transformConfigView', onTransformConfigView);
    scheduler.on('resetZoom', () => {
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
    });

    scheduler.on('zoomIntoFrame', (frame: FlamegraphFrame) => {
      if (
        flamegraph.frameIndex[frame.frame.key] &&
        flamegraph.frameIndex[frame.frame.key].name !== frame.frame.name
      ) {
        return;
      }

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
    });

    scheduler.registerBeforeFrameCallback(clearOverlayCanvas);
    scheduler.registerBeforeFrameCallback(drawRectangles);
    scheduler.registerAfterFrameCallback(drawText);

    const observer = watchForResize(
      [flamegraphCanvasRef, flamegraphOverlayCanvasRef],
      () => {
        flamegraphRenderer.onResizeUpdateSpace();
        canvasPoolManager.dispatch('setConfigView', [flamegraphRenderer.configView]);
        scheduler.drawSync();
      }
    );

    canvasPoolManager.registerScheduler(scheduler);

    return function () {
      setScheduler(null);
      canvasPoolManager.unregisterScheduler(scheduler);
      observer.disconnect();
    };
  }, [
    canvasPoolManager,
    flamegraph,
    flamegraphTheme,
    flamegraphCanvasRef,
    flamegraphOverlayCanvasRef,
    flamegraphRenderer,
    searchResults,
  ]);

  const selectedFrameRenderer = useMemo(() => {
    if (!flamegraphOverlayCanvasRef) {
      return null;
    }
    return new SelectedFrameRenderer(flamegraphOverlayCanvasRef);
  }, [flamegraphOverlayCanvasRef, flamegraph, flamegraphTheme]);

  const [selectedNode, setSelectedNode] = useState<FlamegraphFrame | null>(null);

  const [configSpaceCursor, setConfigSpaceCursor] = useState<[number, number] | null>(
    null
  );
  const hoveredNode = useMemo(() => {
    if (!configSpaceCursor || !flamegraphRenderer) {
      return null;
    }
    return flamegraphRenderer.getHoveredNode(configSpaceCursor);
  }, [configSpaceCursor, flamegraphRenderer]);

  useEffect(() => {
    if (!selectedFrameRenderer || !flamegraphRenderer || !scheduler || !textRenderer) {
      return;
    }

    const drawSelectedFrameBorder = () => {
      if (!selectedNode && !hoveredNode) {
        return;
      }

      textRenderer.context.clearRect(
        0,
        0,
        flamegraphRenderer.physicalSpace.width,
        flamegraphRenderer.physicalSpace.height
      );

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

      textRenderer.draw(
        flamegraphRenderer.configView,
        flamegraphRenderer.configSpace,
        flamegraphRenderer.configToPhysicalSpace
      );
    };

    scheduler.registerBeforeFrameCallback(drawSelectedFrameBorder);
    scheduler.draw();

    return function () {
      scheduler.unregisterBeforeFrameCallback(drawSelectedFrameBorder);
    };
  }, [
    textRenderer,
    selectedFrameRenderer,
    selectedNode,
    hoveredNode,
    scheduler,
    flamegraphRenderer,
    flamegraph,
  ]);

  const onCanvasClick = useCallback(
    (evt: React.MouseEvent<HTMLCanvasElement>) => {
      evt.preventDefault();
      evt.stopPropagation();

      if (!flamegraphRenderer || !configSpaceCursor) {
        return;
      }

      const newSelectedNode = flamegraphRenderer.getHoveredNode(configSpaceCursor);

      if (newSelectedNode && selectedNode && newSelectedNode === selectedNode) {
        canvasPoolManager.dispatch('zoomIntoFrame', [newSelectedNode]);
      }

      setSelectedNode(newSelectedNode);
      canvasPoolManager.dispatch('selectedNode', [newSelectedNode]);
    },
    [flamegraphRenderer, configSpaceCursor, selectedNode, canvasPoolManager]
  );

  const onCanvasMouseMove = useCallback(
    (evt: React.MouseEvent<HTMLCanvasElement>) => {
      if (!flamegraphRenderer) {
        return;
      }
      if (!flamegraphRenderer.frames.length) {
        return;
      }

      const configSpaceMouse = flamegraphRenderer.getConfigSpaceCursor(
        vec2.fromValues(evt.nativeEvent.offsetX, evt.nativeEvent.offsetY)
      );

      setConfigSpaceCursor([configSpaceMouse[0], configSpaceMouse[1]]);
    },
    [flamegraphRenderer, setConfigSpaceCursor]
  );

  const onCanvasMouseLeave = useCallback(() => {
    setConfigSpaceCursor(null);
  }, []);

  const zoom = useCallback(
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
    [flamegraphRenderer, canvasPoolManager]
  );

  const scroll = useCallback(
    (evt: WheelEvent) => {
      if (!flamegraphRenderer || !flamegraphRenderer.frames.length) {
        return;
      }

      {
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
      }
    },
    [flamegraphRenderer, canvasPoolManager]
  );

  useEffect(() => {
    if (!flamegraphCanvasRef) {
      return;
    }

    const onCanvasWheel = (evt: WheelEvent) => {
      setConfigSpaceCursor(null);
      const isZoom = evt.metaKey;

      evt.preventDefault();

      if (isZoom) {
        zoom(evt);
      } else {
        scroll(evt);
      }
    };

    flamegraphCanvasRef.addEventListener('wheel', onCanvasWheel);

    return function () {
      flamegraphCanvasRef.removeEventListener('wheel', onCanvasWheel);
    };
  }, [flamegraphCanvasRef, zoom, scroll]);

  return (
    <React.Fragment>
      <canvas
        style={{
          width: '100%',
          height: '100%',
          left: 0,
          top: 0,
          userSelect: 'none',
          position: 'absolute',
        }}
        ref={canvas => setFlamegraphCanvasRef(canvas)}
        onClick={onCanvasClick}
        onMouseMove={onCanvasMouseMove}
        onMouseLeave={onCanvasMouseLeave}
      />
      <canvas
        ref={canvas => setFlamegraphOverlayCanvasRef(canvas)}
        style={{
          width: '100%',
          height: '100%',
          left: 0,
          top: 0,
          userSelect: 'none',
          position: 'absolute',
          pointerEvents: 'none',
        }}
      />
    </React.Fragment>
  );
}

export {FlamegraphZoomView};
