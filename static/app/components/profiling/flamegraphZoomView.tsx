import React, {useCallback, useEffect, useMemo, useState} from 'react';
import styled from '@emotion/styled';
import {mat3, vec2} from 'gl-matrix';

import {CanvasPoolManager, CanvasScheduler} from 'sentry/utils/profiling/canvasScheduler';
import {DifferentialFlamegraph} from 'sentry/utils/profiling/differentialFlamegraph';
import {Flamegraph} from 'sentry/utils/profiling/flamegraph';
import {useFlamegraphPreferencesValue} from 'sentry/utils/profiling/flamegraph/useFlamegraphPreferences';
import {useFlamegraphTheme} from 'sentry/utils/profiling/flamegraph/useFlamegraphTheme';
import {FlamegraphFrame} from 'sentry/utils/profiling/flamegraphFrame';
import {Rect, watchForResize} from 'sentry/utils/profiling/gl/utils';
import {FlamegraphRenderer} from 'sentry/utils/profiling/renderers/flamegraphRenderer';
import {GridRenderer} from 'sentry/utils/profiling/renderers/gridRenderer';
import {SelectedFrameRenderer} from 'sentry/utils/profiling/renderers/selectedFrameRenderer';
import {TextRenderer} from 'sentry/utils/profiling/renderers/textRenderer';
import {useMemoWithPrevious} from 'sentry/utils/useMemoWithPrevious';

import {BoundTooltip} from './boundTooltip';

interface FlamegraphZoomViewProps {
  canvasPoolManager: CanvasPoolManager;
  flamegraph: Flamegraph | DifferentialFlamegraph;
  showSelectedNodeStack?: boolean;
}

function FlamegraphZoomView({
  flamegraph,
  canvasPoolManager,
}: FlamegraphZoomViewProps): React.ReactElement {
  const flamegraphPreferences = useFlamegraphPreferencesValue();
  const flamegraphTheme = useFlamegraphTheme();

  const [flamegraphCanvasRef, setFlamegraphCanvasRef] =
    useState<HTMLCanvasElement | null>(null);
  const [flamegraphOverlayCanvasRef, setFlamegraphOverlayCanvasRef] =
    useState<HTMLCanvasElement | null>(null);

  const scheduler = useMemo(() => new CanvasScheduler(), []);

  const [canvasBounds, setCanvasBounds] = useState<Rect>(Rect.Empty());
  const [searchResults, setSearchResults] = useState<Record<string, FlamegraphFrame>>({});

  const flamegraphRenderer = useMemoWithPrevious<FlamegraphRenderer | null>(
    previousRenderer => {
      if (flamegraphCanvasRef) {
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

        // If the flamegraph name is the same as before, then the user probably changed the way they want
        // to visualize the flamegraph. In those cases we want preserve the previous config view so
        // that users dont lose their state. E.g. clicking on invert flamegraph still shows you the same
        // flamegraph you were looking at before, just inverted instead of zooming out completely
        if (previousRenderer?.flamegraph.name === renderer.flamegraph.name) {
          renderer.setConfigView(previousRenderer.configView);
        }
        return renderer;
      }
      // If we have no renderer, then the canvas is not initialize yet and we cannot initialize the renderer
      return null;
    },
    [
      flamegraphCanvasRef,
      flamegraphTheme,
      flamegraph,
      canvasPoolManager,
      flamegraphPreferences.colorCoding,
    ]
  );

  const textRenderer: TextRenderer | null = useMemo(() => {
    if (!flamegraphOverlayCanvasRef) {
      return null;
    }
    return new TextRenderer(flamegraphOverlayCanvasRef, flamegraph, flamegraphTheme);
  }, [flamegraphOverlayCanvasRef, flamegraph, flamegraphTheme]);

  const gridRenderer: GridRenderer | null = useMemo(() => {
    if (!flamegraphOverlayCanvasRef) {
      return null;
    }
    return new GridRenderer(
      flamegraphOverlayCanvasRef,
      flamegraphTheme,
      flamegraph.formatter
    );
  }, [flamegraphOverlayCanvasRef, flamegraph, flamegraphTheme]);

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
    if (!flamegraphRenderer) {
      return undefined;
    }

    const drawRectangles = () => {
      flamegraphRenderer.draw(searchResults);
    };

    scheduler.registerBeforeFrameCallback(drawRectangles);

    return () => {
      scheduler.unregisterBeforeFrameCallback(drawRectangles);
    };
  }, [scheduler, flamegraphRenderer, searchResults]);

  useEffect(() => {
    if (!flamegraphRenderer || !textRenderer || !gridRenderer || !selectedFrameRenderer) {
      return undefined;
    }

    const clearOverlayCanvas = () => {
      textRenderer.context.clearRect(
        0,
        0,
        flamegraphRenderer.physicalSpace.width,
        flamegraphRenderer.physicalSpace.height
      );
    };

    const drawSelectedFrameBorder = () => {
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

    const drawText = () => {
      textRenderer.draw(
        flamegraphRenderer.configView,
        flamegraphRenderer.configSpace,
        flamegraphRenderer.configToPhysicalSpace
      );
    };

    const drawGrid = () => {
      gridRenderer.draw(
        flamegraphRenderer.configView,
        flamegraphRenderer.physicalSpace,
        flamegraphRenderer.configToPhysicalSpace
      );
    };

    scheduler.registerBeforeFrameCallback(clearOverlayCanvas);
    scheduler.registerBeforeFrameCallback(drawSelectedFrameBorder);
    scheduler.registerAfterFrameCallback(drawText);
    scheduler.registerAfterFrameCallback(drawGrid);

    scheduler.draw();

    return () => {
      scheduler.unregisterBeforeFrameCallback(clearOverlayCanvas);
      scheduler.unregisterBeforeFrameCallback(drawSelectedFrameBorder);
      scheduler.unregisterAfterFrameCallback(drawText);
      scheduler.unregisterAfterFrameCallback(drawGrid);
    };
  }, [
    scheduler,
    flamegraphRenderer,
    textRenderer,
    gridRenderer,
    selectedNode,
    hoveredNode,
  ]);

  useEffect(() => {
    if (!flamegraphRenderer) {
      return undefined;
    }

    const onConfigViewChange = (rect: Rect) => {
      flamegraphRenderer.setConfigView(rect);
      scheduler.draw();
    };

    const onTransformConfigView = (mat: mat3) => {
      flamegraphRenderer.transformConfigView(mat);
      scheduler.draw();
    };

    const onResetZoom = () => {
      flamegraphRenderer.setConfigView(
        flamegraph.inverted
          ? flamegraphRenderer.configView
              .translateY(
                flamegraphRenderer.configSpace.height -
                  flamegraphRenderer.configView.height +
                  1
              )
              .translate(0, 0)
              .withWidth(flamegraph.configSpace.width)
          : flamegraphRenderer.configView
              .translate(0, 0)
              .withWidth(flamegraph.configSpace.width)
      );

      setConfigSpaceCursor(null);
      scheduler.draw();
    };

    const onZoomIntoFrame = (frame: FlamegraphFrame) => {
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
      setSelectedNode(frame);

      scheduler.draw();
    };

    const onSearchResultsChange = (results: Record<string, FlamegraphFrame>) => {
      setSearchResults(results);
      scheduler.draw();
    };

    scheduler.on('setConfigView', onConfigViewChange);
    scheduler.on('transformConfigView', onTransformConfigView);
    scheduler.on('resetZoom', onResetZoom);
    scheduler.on('zoomIntoFrame', onZoomIntoFrame);
    scheduler.on('searchResults', onSearchResultsChange);

    return () => {
      scheduler.off('setConfigView', onConfigViewChange);
      scheduler.off('transformConfigView', onTransformConfigView);
      scheduler.off('resetZoom', onResetZoom);
      scheduler.off('zoomIntoFrame', onZoomIntoFrame);
      scheduler.off('searchResults', onSearchResultsChange);
    };
  }, [scheduler, flamegraphRenderer]);

  useEffect(() => {
    if (!flamegraphCanvasRef || !flamegraphOverlayCanvasRef || !flamegraphRenderer) {
      return undefined;
    }

    const observer = watchForResize(
      [flamegraphCanvasRef, flamegraphOverlayCanvasRef],
      () => {
        const bounds = flamegraphOverlayCanvasRef.getBoundingClientRect();
        setCanvasBounds(new Rect(bounds.x, bounds.y, bounds.width, bounds.height));

        flamegraphRenderer.onResizeUpdateSpace();
        canvasPoolManager.dispatch('setConfigView', [flamegraphRenderer.configView]);
        scheduler.drawSync();
      }
    );
    return () => observer.disconnect();
  }, [scheduler, flamegraphCanvasRef, flamegraphOverlayCanvasRef, flamegraphRenderer]);

  useEffect(() => {
    canvasPoolManager.registerScheduler(scheduler);
    return () => canvasPoolManager.unregisterScheduler(scheduler);
  }, [canvasPoolManager, scheduler]);

  const onCanvasClick = useCallback(
    (evt: React.MouseEvent<HTMLCanvasElement>) => {
      evt.preventDefault();
      evt.stopPropagation();

      if (!flamegraphRenderer || !configSpaceCursor) {
        return;
      }

      // Only dispatch the zoom action if the new clicked node is not the same as the old selected node.
      // This essentialy tracks double click action on a rectangle
      if (hoveredNode && selectedNode && hoveredNode === selectedNode) {
        canvasPoolManager.dispatch('zoomIntoFrame', [hoveredNode]);
      }

      setSelectedNode(hoveredNode);
      canvasPoolManager.dispatch('selectedNode', [hoveredNode]);
    },
    [flamegraphRenderer, configSpaceCursor, selectedNode, hoveredNode, canvasPoolManager]
  );

  const onCanvasMouseMove = useCallback(
    (evt: React.MouseEvent<HTMLCanvasElement>) => {
      if (!flamegraphRenderer?.frames.length) {
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
      if (!flamegraphRenderer?.frames.length) {
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
      if (!flamegraphRenderer?.frames.length) {
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
    [flamegraphRenderer, canvasPoolManager]
  );

  useEffect(() => {
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

    return () => {
      flamegraphCanvasRef.removeEventListener('wheel', onCanvasWheel);
    };
  }, [flamegraphCanvasRef, zoom, scroll]);

  return (
    <React.Fragment>
      <Canvas
        ref={canvas => setFlamegraphCanvasRef(canvas)}
        onClick={onCanvasClick}
        onMouseMove={onCanvasMouseMove}
        onMouseLeave={onCanvasMouseLeave}
      />
      <Canvas
        ref={canvas => setFlamegraphOverlayCanvasRef(canvas)}
        style={{
          pointerEvents: 'none',
        }}
      />
      {flamegraphRenderer ? (
        <BoundTooltip
          bounds={canvasBounds}
          cursor={configSpaceCursor}
          configToPhysicalSpace={flamegraphRenderer?.configToPhysicalSpace}
        >
          {hoveredNode?.frame?.name}
        </BoundTooltip>
      ) : null}
    </React.Fragment>
  );
}

const Canvas = styled('canvas')`
  left: 0;
  top: 0;
  width: 100%;
  height: 100%;
  user-select: none;
  position: absolute;
`;

export {FlamegraphZoomView};
