import {Fragment, useCallback, useEffect, useMemo, useRef, useState} from 'react';
import styled from '@emotion/styled';
import {mat3, vec2} from 'gl-matrix';

import {CanvasPoolManager, CanvasScheduler} from 'sentry/utils/profiling/canvasScheduler';
import {DifferentialFlamegraph} from 'sentry/utils/profiling/differentialFlamegraph';
import {Flamegraph} from 'sentry/utils/profiling/flamegraph';
import {useFlamegraphPreferencesValue} from 'sentry/utils/profiling/flamegraph/useFlamegraphPreferences';
import {
  useDispatchFlamegraphState,
  useFlamegraphState,
} from 'sentry/utils/profiling/flamegraph/useFlamegraphState';
import {useFlamegraphTheme} from 'sentry/utils/profiling/flamegraph/useFlamegraphTheme';
import {FlamegraphFrame} from 'sentry/utils/profiling/flamegraphFrame';
import {Rect, watchForResize} from 'sentry/utils/profiling/gl/utils';
import {FlamegraphRenderer} from 'sentry/utils/profiling/renderers/flamegraphRenderer';
import {GridRenderer} from 'sentry/utils/profiling/renderers/gridRenderer';
import {SelectedFrameRenderer} from 'sentry/utils/profiling/renderers/selectedFrameRenderer';
import {TextRenderer} from 'sentry/utils/profiling/renderers/textRenderer';
import {useMemoWithPrevious} from 'sentry/utils/useMemoWithPrevious';
import usePrevious from 'sentry/utils/usePrevious';

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
  const flamegraphTheme = useFlamegraphTheme();

  const [lastInteraction, setLastInteraction] = useState<
    'pan' | 'click' | 'zoom' | 'scroll' | null
  >(null);

  const [dispatch, {previousState, nextState}] = useDispatchFlamegraphState();
  const flamegraphPreferences = useFlamegraphPreferencesValue();

  const [flamegraphCanvasRef, setFlamegraphCanvasRef] =
    useState<HTMLCanvasElement | null>(null);
  const [flamegraphOverlayCanvasRef, setFlamegraphOverlayCanvasRef] =
    useState<HTMLCanvasElement | null>(null);

  const scheduler = useMemo(() => new CanvasScheduler(), []);

  const [flamegraphState, dispatchFlamegraphState] = useFlamegraphState();
  const [canvasBounds, setCanvasBounds] = useState<Rect>(Rect.Empty());
  const [startPanVector, setStartPanVector] = useState<vec2 | null>(null);
  const [selectedNode, setSelectedNode] = useState<FlamegraphFrame | null>(null);
  const [configSpaceCursor, setConfigSpaceCursor] = useState<vec2 | null>(null);

  const flamegraphRenderer = useMemoWithPrevious<FlamegraphRenderer | null>(
    previousRenderer => {
      if (flamegraphCanvasRef) {
        const renderer = new FlamegraphRenderer(
          flamegraphCanvasRef,
          flamegraph,
          flamegraphTheme,
          vec2.fromValues(
            0,
            flamegraphTheme.SIZES.TIMELINE_HEIGHT * window.devicePixelRatio
          ),
          {draw_border: true}
        );

        if (!previousRenderer?.configSpace.equals(renderer.configSpace)) {
          return renderer;
        }

        if (previousRenderer?.flamegraph.profile === renderer.flamegraph.profile) {
          if (previousRenderer.flamegraph.inverted !== renderer.flamegraph.inverted) {
            // Preserve the position where the user just was before they toggled
            // inverted. This means that the horizontal position is unchanged
            // while the vertical position needs to determined based on the
            // current position.
            renderer.setConfigView(
              previousRenderer.configView.translateY(
                previousRenderer.configSpace.height -
                  previousRenderer.configView.height -
                  previousRenderer.configView.y
              )
            );
          } else if (
            previousRenderer.flamegraph.leftHeavy !== renderer.flamegraph.leftHeavy
          ) {
            // When the user toggles left heavy, the entire flamegraph will take
            // on a different shape. In this case, there's no obvious position
            // that can be carried over.
          } else {
            renderer.setConfigView(previousRenderer.configView);
          }
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

  const hoveredNode = useMemo(() => {
    if (!configSpaceCursor || !flamegraphRenderer) {
      return null;
    }
    return flamegraphRenderer.getHoveredNode(configSpaceCursor);
  }, [configSpaceCursor, flamegraphRenderer]);

  useEffect(() => {
    scheduler.draw();
  }, [flamegraphState.search.results]);

  useEffect(() => {
    const onKeyDown = (evt: KeyboardEvent) => {
      if (!flamegraphRenderer) {
        return;
      }

      if (evt.key === 'z' && evt.metaKey) {
        const action = evt.shiftKey ? 'redo' : 'undo';

        if (action === 'undo') {
          const previousPosition = previousState?.position?.view;

          // If previous position is empty, reset the view to it's max
          if (previousPosition?.isEmpty()) {
            canvasPoolManager.dispatch('resetZoom', []);
          } else if (
            previousPosition &&
            !previousPosition?.equals(flamegraphRenderer.configView)
          ) {
            // We need to always dispatch with the height of the current view,
            // because the height may have changed due to window resizing and
            // calling it with the old height may result in the flamegraph
            // being drawn into a very small or very large area.
            canvasPoolManager.dispatch('setConfigView', [
              previousPosition.withHeight(flamegraphRenderer.configView.height),
            ]);
          }
        }

        if (action === 'redo') {
          const nextPosition = nextState?.position?.view;

          if (nextPosition && !nextPosition.equals(flamegraphRenderer.configView)) {
            // We need to always dispatch with the height of the current view,
            // because the height may have changed due to window resizing and
            // calling it with the old height may result in the flamegraph
            // being drawn into a very small or very large area.
            canvasPoolManager.dispatch('setConfigView', [
              nextPosition.withHeight(flamegraphRenderer.configView.height),
            ]);
          }
        }

        dispatchFlamegraphState({type: action});
      }
    };

    document.addEventListener('keydown', onKeyDown);

    return () => {
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [flamegraphRenderer, previousState, nextState, scheduler]);

  const previousInteraction = usePrevious(lastInteraction);
  const beforeInteractionConfigView = useRef<Rect | null>(null);
  useEffect(() => {
    if (!flamegraphRenderer) {
      return;
    }

    // Check if we are starting a new interaction
    if (previousInteraction === null && lastInteraction) {
      beforeInteractionConfigView.current = flamegraphRenderer.configView.clone();
      return;
    }

    if (
      beforeInteractionConfigView.current &&
      !beforeInteractionConfigView.current.equals(flamegraphRenderer.configView)
    ) {
      dispatch({type: 'checkpoint', payload: flamegraphRenderer.configView.clone()});
    }
  }, [lastInteraction, flamegraphRenderer]);

  useEffect(() => {
    if (!flamegraphRenderer) {
      return undefined;
    }

    const drawRectangles = () => {
      flamegraphRenderer.draw(flamegraphState.search.results);
    };

    scheduler.registerBeforeFrameCallback(drawRectangles);

    return () => {
      scheduler.unregisterBeforeFrameCallback(drawRectangles);
    };
  }, [scheduler, flamegraphRenderer, flamegraphState.search.results]);

  useEffect(() => {
    if (!flamegraphRenderer || !textRenderer || !gridRenderer || !selectedFrameRenderer) {
      return undefined;
    }

    const clearOverlayCanvas = () => {
      textRenderer.context.clearRect(
        0,
        0,
        textRenderer.canvas.width,
        textRenderer.canvas.height
      );
    };

    const drawSelectedFrameBorder = () => {
      if (selectedNode) {
        selectedFrameRenderer.draw(
          new Rect(
            selectedNode.start,
            flamegraph.inverted
              ? flamegraphRenderer.configSpace.height - selectedNode.depth - 1
              : selectedNode.depth,
            selectedNode.end - selectedNode.start,
            1
          ),
          {
            BORDER_COLOR: flamegraphRenderer.theme.COLORS.SELECTED_FRAME_BORDER_COLOR,
            BORDER_WIDTH: flamegraphRenderer.theme.SIZES.FRAME_BORDER_WIDTH,
          },
          selectedFrameRenderer.context,
          flamegraphRenderer.configViewToPhysicalSpace
        );
      }

      if (hoveredNode && selectedNode !== hoveredNode) {
        selectedFrameRenderer.draw(
          new Rect(
            hoveredNode.start,
            flamegraph.inverted
              ? flamegraphRenderer.configSpace.height - hoveredNode.depth - 1
              : hoveredNode.depth,
            hoveredNode.end - hoveredNode.start,
            1
          ),
          {
            BORDER_COLOR: flamegraphRenderer.theme.COLORS.HOVERED_FRAME_BORDER_COLOR,
            BORDER_WIDTH: flamegraphRenderer.theme.SIZES.HOVERED_FRAME_BORDER_WIDTH,
          },
          selectedFrameRenderer.context,
          flamegraphRenderer.configViewToPhysicalSpace
        );
      }
    };

    const drawText = () => {
      textRenderer.draw(
        flamegraphRenderer.configView,
        flamegraphRenderer.configSpace,
        flamegraphRenderer.configViewToPhysicalSpace
      );
    };

    const drawGrid = () => {
      gridRenderer.draw(
        flamegraphRenderer.configView,
        flamegraphRenderer.physicalSpace,
        flamegraphRenderer.configViewToPhysicalSpace
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
    flamegraph,
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
      flamegraphRenderer.resetConfigView();
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

  const onCanvasMouseDown = useCallback(
    (evt: React.MouseEvent<HTMLCanvasElement>) => {
      if (!flamegraphRenderer) {
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

      setLastInteraction('click');
      setStartPanVector(physicalMousePos);
    },
    [flamegraphRenderer]
  );

  const onCanvasMouseUp = useCallback(
    (evt: React.MouseEvent<HTMLCanvasElement>) => {
      evt.preventDefault();
      evt.stopPropagation();

      if (!flamegraphRenderer || !configSpaceCursor) {
        setLastInteraction(null);
        setStartPanVector(null);
        return;
      }

      // Only dispatch the zoom action if the new clicked node is not the same as the old selected node.
      // This essentialy tracks double click action on a rectangle
      if (lastInteraction === 'click') {
        if (hoveredNode && selectedNode && hoveredNode === selectedNode) {
          canvasPoolManager.dispatch('zoomIntoFrame', [hoveredNode]);
        }
        canvasPoolManager.dispatch('selectedNode', [hoveredNode]);
        setSelectedNode(hoveredNode);
      }

      setLastInteraction(null);
      setStartPanVector(null);
    },
    [
      flamegraphRenderer,
      configSpaceCursor,
      selectedNode,
      hoveredNode,
      canvasPoolManager,
      startPanVector,
      lastInteraction,
    ]
  );

  const onMouseDrag = useCallback(
    (evt: React.MouseEvent<HTMLCanvasElement>) => {
      if (!startPanVector || !flamegraphRenderer) {
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
        startPanVector,
        physicalMousePos
      );

      if (physicalDelta[0] === 0 && physicalDelta[1] === 0) {
        return;
      }

      const physicalToConfig = mat3.invert(
        mat3.create(),
        flamegraphRenderer.configViewToPhysicalSpace
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

      canvasPoolManager.dispatch('transformConfigView', [
        mat3.fromTranslation(mat3.create(), configDelta),
      ]);

      setStartPanVector(physicalMousePos);
    },
    [flamegraphRenderer, startPanVector]
  );

  const onCanvasMouseMove = useCallback(
    (evt: React.MouseEvent<HTMLCanvasElement>) => {
      if (!flamegraphRenderer?.frames.length) {
        return;
      }

      const configSpaceMouse = flamegraphRenderer.getConfigSpaceCursor(
        vec2.fromValues(evt.nativeEvent.offsetX, evt.nativeEvent.offsetY)
      );

      setConfigSpaceCursor(configSpaceMouse);

      if (startPanVector) {
        onMouseDrag(evt);
        setLastInteraction('pan');
      } else {
        setLastInteraction(null);
      }
    },
    [
      flamegraphRenderer,
      setConfigSpaceCursor,
      onMouseDrag,
      lastInteraction,
      startPanVector,
    ]
  );

  const onCanvasMouseLeave = useCallback(() => {
    setConfigSpaceCursor(null);
    setStartPanVector(null);
    setLastInteraction(null);
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
        flamegraphRenderer.configViewToPhysicalSpace
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

    let wheelStopTimeoutId: number | undefined;
    function onCanvasWheel(evt: WheelEvent) {
      window.clearTimeout(wheelStopTimeoutId);
      wheelStopTimeoutId = window.setTimeout(() => {
        setLastInteraction(null);
      }, 300);

      if (!flamegraphRenderer) {
        return;
      }
      evt.preventDefault();

      // When we zoom, we want to clear cursor so that any tooltips
      // rendered on the flamegraph are removed from the view
      setConfigSpaceCursor(null);

      if (evt.metaKey) {
        zoom(evt);
        setLastInteraction('zoom');
      } else {
        scroll(evt);
        setLastInteraction('scroll');
      }
    }

    flamegraphCanvasRef.addEventListener('wheel', onCanvasWheel);

    return () => {
      window.clearTimeout(wheelStopTimeoutId);
      flamegraphCanvasRef.removeEventListener('wheel', onCanvasWheel);
    };
  }, [flamegraphCanvasRef, flamegraphRenderer, zoom, scroll]);

  return (
    <Fragment>
      <Canvas
        ref={canvas => setFlamegraphCanvasRef(canvas)}
        onMouseDown={onCanvasMouseDown}
        onMouseUp={onCanvasMouseUp}
        onMouseMove={onCanvasMouseMove}
        onMouseLeave={onCanvasMouseLeave}
        style={{cursor: lastInteraction === 'pan' ? 'grab' : 'default'}}
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
          configViewToPhysicalSpace={flamegraphRenderer?.configViewToPhysicalSpace}
        >
          {hoveredNode?.frame?.name}
        </BoundTooltip>
      ) : null}
    </Fragment>
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
