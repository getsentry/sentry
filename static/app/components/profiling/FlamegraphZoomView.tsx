import * as React from 'react';
import {mat3, vec2} from 'gl-matrix';

import {CanvasPoolManager, CanvasScheduler} from 'sentry/utils/profiling/canvasScheduler';
import {DifferentialFlamegraph} from 'sentry/utils/profiling/differentialFlamegraph';
import {Flamegraph} from 'sentry/utils/profiling/flamegraph';
import {FlamegraphTheme} from 'sentry/utils/profiling/flamegraph/FlamegraphTheme';
import {FlamegraphFrame} from 'sentry/utils/profiling/flamegraphFrame';
import {Rect, watchForResize} from 'sentry/utils/profiling/gl/utils';
import {FlamegraphRenderer} from 'sentry/utils/profiling/renderers/flamegraphRenderer';
import {GridRenderer} from 'sentry/utils/profiling/renderers/gridRenderer';
import {SelectedFrameRenderer} from 'sentry/utils/profiling/renderers/selectedFrameRenderer';
import {TextRenderer} from 'sentry/utils/profiling/renderers/textRenderer';
import {useMemoWithPrevious} from 'sentry/utils/useMemoWithPrevious';

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
}: FlamegraphZoomViewProps): React.ReactElement {
  const [scheduler, setScheduler] = React.useState<CanvasScheduler | null>(null);
  const [flamegraphCanvasRef, setFlamegraphCanvasRef] =
    React.useState<HTMLCanvasElement | null>(null);
  const [flamegraphOverlayCanvasRef, setFlamegraphOverlayCanvasRef] =
    React.useState<HTMLCanvasElement | null>(null);

  const [gridRenderer, setGridRenderer] = React.useState<GridRenderer | null>(null);
  const [textRenderer, setTextRenderer] = React.useState<TextRenderer | null>(null);

  const flamegraphRenderer = useMemoWithPrevious<FlamegraphRenderer | null>(
    previousRenderer => {
      if (flamegraphCanvasRef === null) {
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

  React.useEffect(() => {
    if (
      flamegraphCanvasRef === null ||
      flamegraphOverlayCanvasRef === null ||
      flamegraphRenderer === null
    ) {
      return undefined;
    }

    const newTextRenderer = new TextRenderer(
      flamegraphOverlayCanvasRef,
      flamegraph,
      flamegraphTheme
    );

    const newGridRenderer = new GridRenderer(
      flamegraphOverlayCanvasRef,
      flamegraphTheme,
      flamegraph.formatter
    );

    const newScheduler = new CanvasScheduler();

    setSelectedNode(null);
    setConfigSpaceCursor(null);
    setScheduler(newScheduler);
    setTextRenderer(newTextRenderer);
    setGridRenderer(newGridRenderer);

    function clearOverlayCanvas() {
      // We are doing this because of typescript, in reality we are creating a scope
      // where flamegraphRenderer is not null (see check on L86)
      if (flamegraphRenderer === null) {
        return;
      }
      newTextRenderer.context.clearRect(
        0,
        0,
        flamegraphRenderer!.physicalSpace.width,
        flamegraphRenderer!.physicalSpace.height
      );
    }

    function drawText() {
      // We are doing this because of typescript, in reality we are creating a scope
      // where flamegraphRenderer is not null (see check on L86)
      if (flamegraphRenderer === null) {
        return;
      }
      newTextRenderer.draw(
        flamegraphRenderer.configView,
        flamegraphRenderer.configSpace,
        flamegraphRenderer.configToPhysicalSpace
      );
    }

    function drawRectangles() {
      // We are doing this because of typescript, in reality we are creating a scope
      // where flamegraphRenderer is not null (see check on L86)
      if (flamegraphRenderer === null) {
        return;
      }
      flamegraphRenderer.draw(searchResults);
    }

    function drawGrid() {
      // We are doing this because of typescript, in reality we are creating a scope
      // where flamegraphRenderer is not null (see check on L86)
      if (flamegraphRenderer === null) {
        return;
      }
      newGridRenderer.draw(
        flamegraphRenderer.configView,
        flamegraphRenderer.physicalSpace,
        flamegraphRenderer.configToPhysicalSpace
      );
    }

    function onConfigViewChange(rect: Rect) {
      // We are doing this because of typescript, in reality we are creating a scope
      // where flamegraphRenderer is not null (see check on L86)
      if (flamegraphRenderer === null) {
        return;
      }
      flamegraphRenderer.setConfigView(rect);
      newScheduler.draw();
    }

    function onTransformConfigView(mat: mat3) {
      // We are doing this because of typescript, in reality we are creating a scope
      // where flamegraphRenderer is not null (see check on L86)
      if (flamegraphRenderer === null) {
        return;
      }
      flamegraphRenderer.transformConfigView(mat);
      newScheduler.draw();
    }

    newScheduler.on('setConfigView', onConfigViewChange);
    newScheduler.on('transformConfigView', onTransformConfigView);
    newScheduler.on('resetZoom', () => {
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
      newScheduler.draw();
    });

    newScheduler.on('zoomIntoFrame', (frame: FlamegraphFrame) => {
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
      newScheduler.draw();
    });

    newScheduler.registerBeforeFrameCallback(clearOverlayCanvas);
    newScheduler.registerBeforeFrameCallback(drawRectangles);
    newScheduler.registerAfterFrameCallback(drawText);
    newScheduler.registerAfterFrameCallback(drawGrid);

    const observer = watchForResize(
      [flamegraphCanvasRef, flamegraphOverlayCanvasRef],
      () => {
        flamegraphRenderer.onResizeUpdateSpace();
        canvasPoolManager.dispatch('setConfigView', [flamegraphRenderer.configView]);
        newScheduler.drawSync();
      }
    );

    canvasPoolManager.registerScheduler(newScheduler);

    return function () {
      setScheduler(null);
      // @TODO we can probably keep the grid renderer
      setGridRenderer(null);
      canvasPoolManager.unregisterScheduler(newScheduler);
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

  const selectedFrameRenderer = React.useMemo(() => {
    if (!flamegraphOverlayCanvasRef) {
      return null;
    }
    return new SelectedFrameRenderer(flamegraphOverlayCanvasRef);
  }, [flamegraphOverlayCanvasRef, flamegraph, flamegraphTheme]);

  const [selectedNode, setSelectedNode] = React.useState<FlamegraphFrame | null>(null);

  const [configSpaceCursor, setConfigSpaceCursor] = React.useState<
    [number, number] | null
  >(null);
  const hoveredNode = React.useMemo(() => {
    if (!configSpaceCursor || !flamegraphRenderer) {
      return null;
    }
    return flamegraphRenderer.getHoveredNode(configSpaceCursor);
  }, [configSpaceCursor, flamegraphRenderer]);

  React.useEffect(() => {
    if (
      !selectedFrameRenderer ||
      !flamegraphRenderer ||
      !scheduler ||
      !textRenderer ||
      !gridRenderer
    ) {
      return undefined;
    }

    function drawSelectedFrameBorder() {
      // We are doing this because of typescript, in reality we are creating a scope
      // where flamegraphRenderer is not null (see check on L86)
      if (
        flamegraphRenderer === null ||
        textRenderer === null ||
        selectedFrameRenderer === null
      ) {
        return;
      }

      // If no node is selected or hovered, then dont draw anything
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
    }

    scheduler.registerBeforeFrameCallback(drawSelectedFrameBorder);
    scheduler.draw();

    return () => {
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

  const onCanvasClick = React.useCallback(
    (evt: React.MouseEvent<HTMLCanvasElement>) => {
      evt.preventDefault();
      evt.stopPropagation();

      if (!flamegraphRenderer || !configSpaceCursor) {
        return;
      }

      const newSelectedNode = flamegraphRenderer.getHoveredNode(configSpaceCursor);

      // Only dispatch the zoom action if the new clicked node is not the same as the old selected node
      // This essentialy tracks double click action on a rectangle
      if (newSelectedNode && selectedNode && newSelectedNode === selectedNode) {
        canvasPoolManager.dispatch('zoomIntoFrame', [newSelectedNode]);
      }

      setSelectedNode(newSelectedNode);
      canvasPoolManager.dispatch('selectedNode', [newSelectedNode]);
    },
    [flamegraphRenderer, configSpaceCursor, selectedNode, canvasPoolManager]
  );

  const onCanvasMouseMove = React.useCallback(
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

  const onCanvasMouseLeave = React.useCallback(() => {
    setConfigSpaceCursor(null);
  }, []);

  const zoom = React.useCallback(
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

  const scroll = React.useCallback(
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

  // Register our callback
  React.useEffect(() => {
    if (!flamegraphCanvasRef) {
      return undefined;
    }

    function onCanvasWheel(evt: WheelEvent) {
      // When we zoom, we want to clear cursor so that any tooltips
      // rendered on the flamegraph are removed from the view
      setConfigSpaceCursor(null);
      const isZoom = evt.metaKey;

      evt.preventDefault();

      if (isZoom) {
        zoom(evt);
      } else {
        scroll(evt);
      }
    }

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
          left: 0,
          top: 0,
          width: '100%',
          height: '100%',
          userSelect: 'none',
          position: 'absolute',
          pointerEvents: 'none',
        }}
      />
    </React.Fragment>
  );
}

export {FlamegraphZoomView};
