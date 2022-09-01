import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import styled from '@emotion/styled';
import {mat3, vec2} from 'gl-matrix';

import space from 'sentry/styles/space';
import {CallTreeNode} from 'sentry/utils/profiling/callTreeNode';
import {CanvasPoolManager, CanvasScheduler} from 'sentry/utils/profiling/canvasScheduler';
import {DifferentialFlamegraph} from 'sentry/utils/profiling/differentialFlamegraph';
import {Flamegraph} from 'sentry/utils/profiling/flamegraph';
import {useFlamegraphProfiles} from 'sentry/utils/profiling/flamegraph/useFlamegraphProfiles';
import {useFlamegraphSearch} from 'sentry/utils/profiling/flamegraph/useFlamegraphSearch';
import {
  useDispatchFlamegraphState,
  useFlamegraphState,
} from 'sentry/utils/profiling/flamegraph/useFlamegraphState';
import {useFlamegraphTheme} from 'sentry/utils/profiling/flamegraph/useFlamegraphTheme';
import {FlamegraphCanvas} from 'sentry/utils/profiling/flamegraphCanvas';
import {FlamegraphView} from 'sentry/utils/profiling/flamegraphView';
import {formatColorForFrame, Rect} from 'sentry/utils/profiling/gl/utils';
import {useContextMenu} from 'sentry/utils/profiling/hooks/useContextMenu';
import {useInternalFlamegraphDebugMode} from 'sentry/utils/profiling/hooks/useInternalFlamegraphDebugMode';
import {FlamegraphRenderer} from 'sentry/utils/profiling/renderers/flamegraphRenderer';
import {GridRenderer} from 'sentry/utils/profiling/renderers/gridRenderer';
import {SampleTickRenderer} from 'sentry/utils/profiling/renderers/sampleTickRenderer';
import {SelectedFrameRenderer} from 'sentry/utils/profiling/renderers/selectedFrameRenderer';
import {TextRenderer} from 'sentry/utils/profiling/renderers/textRenderer';
import usePrevious from 'sentry/utils/usePrevious';

import {FlamegraphFrame} from '../../utils/profiling/flamegraphFrame';

import {BoundTooltip} from './boundTooltip';
import {FlamegraphOptionsContextMenu} from './flamegraphOptionsContextMenu';

function formatWeightToProfileDuration(frame: CallTreeNode, flamegraph: Flamegraph) {
  return `(${Math.round((frame.totalWeight / flamegraph.profile.duration) * 100)}%)`;
}

interface FlamegraphZoomViewProps {
  canvasBounds: Rect;
  canvasPoolManager: CanvasPoolManager;
  flamegraph: Flamegraph | DifferentialFlamegraph;
  flamegraphCanvas: FlamegraphCanvas | null;
  flamegraphCanvasRef: HTMLCanvasElement | null;
  flamegraphOverlayCanvasRef: HTMLCanvasElement | null;
  flamegraphRenderer: FlamegraphRenderer | null;
  flamegraphView: FlamegraphView | null;
  setFlamegraphCanvasRef: React.Dispatch<React.SetStateAction<HTMLCanvasElement | null>>;
  setFlamegraphOverlayCanvasRef: React.Dispatch<
    React.SetStateAction<HTMLCanvasElement | null>
  >;
}

function FlamegraphZoomView({
  canvasPoolManager,
  canvasBounds,
  flamegraphRenderer,
  flamegraph,
  flamegraphCanvas,
  flamegraphCanvasRef,
  flamegraphOverlayCanvasRef,
  flamegraphView,
  setFlamegraphCanvasRef,
  setFlamegraphOverlayCanvasRef,
}: FlamegraphZoomViewProps): React.ReactElement {
  const flamegraphTheme = useFlamegraphTheme();
  const [flamegraphProfile] = useFlamegraphProfiles();
  const [flamegraphSearch] = useFlamegraphSearch();
  const isInternalFlamegraphDebugModeEnabled = useInternalFlamegraphDebugMode();

  const [lastInteraction, setLastInteraction] = useState<
    'pan' | 'click' | 'zoom' | 'scroll' | null
  >(null);

  const [dispatch, {previousState, nextState}] = useDispatchFlamegraphState();

  const scheduler = useMemo(() => new CanvasScheduler(), []);

  const [flamegraphState, dispatchFlamegraphState] = useFlamegraphState();
  const [startPanVector, setStartPanVector] = useState<vec2 | null>(null);
  const [configSpaceCursor, setConfigSpaceCursor] = useState<vec2 | null>(null);

  const textRenderer: TextRenderer | null = useMemo(() => {
    if (!flamegraphOverlayCanvasRef) {
      return null;
    }
    return new TextRenderer(flamegraphOverlayCanvasRef, flamegraph, flamegraphTheme);
  }, [flamegraph, flamegraphOverlayCanvasRef, flamegraphTheme]);

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

  const sampleTickRenderer: SampleTickRenderer | null = useMemo(() => {
    if (!isInternalFlamegraphDebugModeEnabled) {
      return null;
    }

    if (!flamegraphOverlayCanvasRef || !flamegraphView?.configSpace) {
      return null;
    }
    return new SampleTickRenderer(
      flamegraphOverlayCanvasRef,
      flamegraph,
      flamegraphView.configSpace,
      flamegraphTheme
    );
  }, [
    isInternalFlamegraphDebugModeEnabled,
    flamegraphOverlayCanvasRef,
    flamegraph,
    flamegraphView?.configSpace,
    flamegraphTheme,
  ]);

  const selectedFrameRenderer = useMemo(() => {
    if (!flamegraphOverlayCanvasRef) {
      return null;
    }
    return new SelectedFrameRenderer(flamegraphOverlayCanvasRef);
  }, [flamegraphOverlayCanvasRef]);

  const hoveredNode: FlamegraphFrame | null = useMemo(() => {
    if (!configSpaceCursor || !flamegraphRenderer) {
      return null;
    }
    return flamegraphRenderer.getHoveredNode(configSpaceCursor);
  }, [configSpaceCursor, flamegraphRenderer]);

  const focusedRects: Rect[] = useMemo(() => {
    if (!flamegraphProfile.focusFrame) {
      return [];
    }

    const rects: Rect[] = [];

    const frames: FlamegraphFrame[] = [...flamegraph.root.children];
    while (frames.length > 0) {
      const frame = frames.pop()!;
      if (
        frame.frame.name === flamegraphProfile.focusFrame.name &&
        frame.frame.image === flamegraphProfile.focusFrame.package
      ) {
        rects.push(new Rect(frame.start, frame.depth, frame.end - frame.start, 1));
      }

      for (let i = 0; i < frame.children.length; i++) {
        frames.push(frame.children[i]);
      }
    }

    return rects;
  }, [flamegraph, flamegraphProfile.focusFrame]);

  useEffect(() => {
    const onKeyDown = (evt: KeyboardEvent) => {
      if (!flamegraphView) {
        return;
      }

      if (evt.key === 'z' && evt.metaKey) {
        const action = evt.shiftKey ? 'redo' : 'undo';

        if (action === 'undo') {
          const previousPosition = previousState?.position?.view;

          // If previous position is empty, reset the view to it's max
          if (previousPosition?.isEmpty()) {
            canvasPoolManager.dispatch('reset zoom', []);
          } else if (
            previousPosition &&
            !previousPosition?.equals(flamegraphView.configView)
          ) {
            // We need to always dispatch with the height of the current view,
            // because the height may have changed due to window resizing and
            // calling it with the old height may result in the flamegraph
            // being drawn into a very small or very large area.
            canvasPoolManager.dispatch('set config view', [
              previousPosition.withHeight(flamegraphView.configView.height),
            ]);
          }
        }

        if (action === 'redo') {
          const nextPosition = nextState?.position?.view;

          if (nextPosition && !nextPosition.equals(flamegraphView.configView)) {
            // We need to always dispatch with the height of the current view,
            // because the height may have changed due to window resizing and
            // calling it with the old height may result in the flamegraph
            // being drawn into a very small or very large area.
            canvasPoolManager.dispatch('set config view', [
              nextPosition.withHeight(flamegraphView.configView.height),
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
  }, [
    canvasPoolManager,
    dispatchFlamegraphState,
    nextState,
    previousState,
    flamegraphView,
  ]);

  const previousInteraction = usePrevious(lastInteraction);
  const beforeInteractionConfigView = useRef<Rect | null>(null);

  useEffect(() => {
    if (!flamegraphView) {
      return;
    }

    // Check if we are starting a new interaction
    if (previousInteraction === null && lastInteraction) {
      beforeInteractionConfigView.current = flamegraphView.configView.clone();
      return;
    }

    if (
      beforeInteractionConfigView.current &&
      !beforeInteractionConfigView.current.equals(flamegraphView.configView)
    ) {
      dispatch({type: 'checkpoint', payload: flamegraphView.configView.clone()});
    }
  }, [dispatch, lastInteraction, previousInteraction, flamegraphView]);

  useEffect(() => {
    if (!flamegraphCanvas || !flamegraphView || !flamegraphRenderer) {
      return undefined;
    }

    const drawRectangles = () => {
      flamegraphRenderer.draw(
        flamegraphView.fromConfigView(flamegraphCanvas.physicalSpace),
        flamegraphState.search.results
      );
    };

    scheduler.registerBeforeFrameCallback(drawRectangles);
    scheduler.draw();

    return () => {
      scheduler.unregisterBeforeFrameCallback(drawRectangles);
    };
  }, [
    flamegraphCanvas,
    flamegraphRenderer,
    flamegraphState.search.results,
    scheduler,
    flamegraphView,
  ]);

  useEffect(() => {
    if (!flamegraphCanvas || !flamegraphView || !textRenderer || !gridRenderer) {
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

    const drawText = () => {
      textRenderer.draw(
        flamegraphView.configView,
        flamegraphView.fromConfigView(flamegraphCanvas.physicalSpace),
        flamegraphSearch.results
      );
    };

    const drawGrid = () => {
      gridRenderer.draw(
        flamegraphView.configView,
        flamegraphCanvas.physicalSpace,
        flamegraphView.fromConfigView(flamegraphCanvas.physicalSpace),
        flamegraphView.toConfigView(flamegraphCanvas.logicalSpace)
      );
    };

    const drawInternalSampleTicks = () => {
      if (!sampleTickRenderer) {
        return;
      }
      sampleTickRenderer.draw(
        flamegraphView.fromConfigView(flamegraphCanvas.physicalSpace),
        flamegraphView.configView
      );
    };

    scheduler.registerBeforeFrameCallback(clearOverlayCanvas);
    scheduler.registerAfterFrameCallback(drawText);
    scheduler.registerAfterFrameCallback(drawGrid);
    scheduler.registerAfterFrameCallback(drawInternalSampleTicks);

    scheduler.draw();

    return () => {
      scheduler.unregisterBeforeFrameCallback(clearOverlayCanvas);
      scheduler.unregisterAfterFrameCallback(drawText);
      scheduler.unregisterAfterFrameCallback(drawGrid);
      scheduler.unregisterAfterFrameCallback(drawInternalSampleTicks);
    };
  }, [
    flamegraphCanvas,
    flamegraphView,
    scheduler,
    flamegraph,
    flamegraphTheme,
    textRenderer,
    gridRenderer,
    sampleTickRenderer,
    canvasPoolManager,
    flamegraphSearch,
  ]);

  useEffect(() => {
    if (!flamegraphCanvas || !flamegraphView || !selectedFrameRenderer) {
      return undefined;
    }

    const drawFocusedFrameBorder = () => {
      selectedFrameRenderer.draw(
        focusedRects,
        {
          BORDER_COLOR: flamegraphTheme.COLORS.FOCUSED_FRAME_BORDER_COLOR,
          BORDER_WIDTH: flamegraphTheme.SIZES.FOCUSED_FRAME_BORDER_WIDTH,
        },
        flamegraphView.fromConfigView(flamegraphCanvas.physicalSpace)
      );
    };

    scheduler.registerAfterFrameCallback(drawFocusedFrameBorder);
    scheduler.draw();

    return () => {
      scheduler.unregisterAfterFrameCallback(drawFocusedFrameBorder);
    };
  }, [
    flamegraphCanvas,
    flamegraphView,
    flamegraphTheme,
    focusedRects,
    scheduler,
    selectedFrameRenderer,
  ]);

  useEffect(() => {
    if (!flamegraphCanvas || !flamegraphView || !selectedFrameRenderer) {
      return undefined;
    }

    const state: {selectedNode: FlamegraphFrame | null} = {
      selectedNode: null,
    };

    const onNodeHighlight = (
      node: FlamegraphFrame | null,
      mode: 'hover' | 'selected'
    ) => {
      if (mode === 'selected') {
        state.selectedNode = node;
      }
      scheduler.draw();
    };

    const drawSelectedFrameBorder = () => {
      if (state.selectedNode) {
        selectedFrameRenderer.draw(
          [
            new Rect(
              state.selectedNode.start,
              state.selectedNode.depth,
              state.selectedNode.end - state.selectedNode.start,
              1
            ),
          ],
          {
            BORDER_COLOR: flamegraphTheme.COLORS.SELECTED_FRAME_BORDER_COLOR,
            BORDER_WIDTH: flamegraphTheme.SIZES.FRAME_BORDER_WIDTH,
          },
          flamegraphView.fromConfigView(flamegraphCanvas.physicalSpace)
        );
      }
    };

    scheduler.on('highlight frame', onNodeHighlight);
    scheduler.registerAfterFrameCallback(drawSelectedFrameBorder);

    return () => {
      scheduler.off('highlight frame', onNodeHighlight);
      scheduler.unregisterAfterFrameCallback(drawSelectedFrameBorder);
    };
  }, [
    flamegraphView,
    flamegraphCanvas,
    scheduler,
    selectedFrameRenderer,
    flamegraphTheme,
  ]);

  useEffect(() => {
    if (!flamegraphCanvas || !flamegraphView || !selectedFrameRenderer) {
      return undefined;
    }

    const drawHoveredFrameBorder = () => {
      if (hoveredNode) {
        selectedFrameRenderer.draw(
          [
            new Rect(
              hoveredNode.start,
              hoveredNode.depth,
              hoveredNode.end - hoveredNode.start,
              1
            ),
          ],
          {
            BORDER_COLOR: flamegraphTheme.COLORS.HOVERED_FRAME_BORDER_COLOR,
            BORDER_WIDTH: flamegraphTheme.SIZES.HOVERED_FRAME_BORDER_WIDTH,
          },
          flamegraphView.fromConfigView(flamegraphCanvas.physicalSpace)
        );
      }
    };

    scheduler.registerAfterFrameCallback(drawHoveredFrameBorder);
    scheduler.draw();

    return () => {
      scheduler.unregisterAfterFrameCallback(drawHoveredFrameBorder);
    };
  }, [
    flamegraphView,
    flamegraphCanvas,
    scheduler,
    hoveredNode,
    selectedFrameRenderer,
    flamegraphTheme,
  ]);

  useEffect(() => {
    if (!flamegraphCanvas || !flamegraphView) {
      return undefined;
    }

    const onResetZoom = () => {
      setConfigSpaceCursor(null);
    };

    const onZoomIntoFrame = () => {
      setConfigSpaceCursor(null);
    };

    scheduler.on('reset zoom', onResetZoom);
    scheduler.on('zoom at frame', onZoomIntoFrame);

    return () => {
      scheduler.off('reset zoom', onResetZoom);
      scheduler.off('zoom at frame', onZoomIntoFrame);
    };
  }, [
    flamegraphCanvas,
    canvasPoolManager,
    dispatchFlamegraphState,
    scheduler,
    flamegraphView,
  ]);

  useEffect(() => {
    canvasPoolManager.registerScheduler(scheduler);
    return () => canvasPoolManager.unregisterScheduler(scheduler);
  }, [canvasPoolManager, scheduler]);

  const onCanvasMouseDown = useCallback((evt: React.MouseEvent<HTMLCanvasElement>) => {
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
  }, []);

  const onCanvasMouseUp = useCallback(
    (evt: React.MouseEvent<HTMLCanvasElement>) => {
      evt.preventDefault();
      evt.stopPropagation();

      if (!configSpaceCursor) {
        setLastInteraction(null);
        setStartPanVector(null);
        return;
      }

      // Only dispatch the zoom action if the new clicked node is not the same as the old selected node.
      // This essentially tracks double click action on a rectangle
      if (lastInteraction === 'click') {
        if (
          hoveredNode &&
          flamegraphState.profiles.selectedRoot &&
          hoveredNode === flamegraphState.profiles.selectedRoot
        ) {
          // If double click is fired on a node, then zoom into it
          canvasPoolManager.dispatch('zoom at frame', [hoveredNode, 'exact']);
        }

        canvasPoolManager.dispatch('highlight frame', [hoveredNode, 'selected']);
        dispatchFlamegraphState({type: 'set selected root', payload: hoveredNode});
      }

      setLastInteraction(null);
      setStartPanVector(null);
    },
    [
      configSpaceCursor,
      flamegraphState.profiles.selectedRoot,
      dispatchFlamegraphState,
      hoveredNode,
      canvasPoolManager,
      lastInteraction,
    ]
  );

  const onMouseDrag = useCallback(
    (evt: React.MouseEvent<HTMLCanvasElement>) => {
      if (!flamegraphCanvas || !flamegraphView || !startPanVector) {
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
        flamegraphView.fromConfigView(flamegraphCanvas.physicalSpace)
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

      canvasPoolManager.dispatch('transform config view', [
        mat3.fromTranslation(mat3.create(), configDelta),
      ]);

      setStartPanVector(physicalMousePos);
    },
    [flamegraphCanvas, flamegraphView, startPanVector, canvasPoolManager]
  );

  const onCanvasMouseMove = useCallback(
    (evt: React.MouseEvent<HTMLCanvasElement>) => {
      if (!flamegraphCanvas || !flamegraphView) {
        return;
      }

      const configSpaceMouse = flamegraphView.getConfigViewCursor(
        vec2.fromValues(evt.nativeEvent.offsetX, evt.nativeEvent.offsetY),
        flamegraphCanvas
      );

      setConfigSpaceCursor(configSpaceMouse);

      if (startPanVector) {
        onMouseDrag(evt);
        setLastInteraction('pan');
      } else {
        setLastInteraction(null);
      }
    },
    [flamegraphCanvas, flamegraphView, setConfigSpaceCursor, onMouseDrag, startPanVector]
  );

  const onCanvasMouseLeave = useCallback(() => {
    setConfigSpaceCursor(null);
    setStartPanVector(null);
    setLastInteraction(null);
  }, []);

  const zoom = useCallback(
    (evt: WheelEvent) => {
      if (!flamegraphCanvas || !flamegraphView) {
        return;
      }

      const identity = mat3.identity(mat3.create());
      const scale = 1 - evt.deltaY * 0.01 * -1; // -1 to invert scale

      const mouseInConfigView = flamegraphView.getConfigViewCursor(
        vec2.fromValues(evt.offsetX, evt.offsetY),
        flamegraphCanvas
      );

      const configCenter = vec2.fromValues(
        mouseInConfigView[0],
        flamegraphView.configView.y
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
    [flamegraphCanvas, flamegraphView, canvasPoolManager]
  );

  const scroll = useCallback(
    (evt: WheelEvent) => {
      if (!flamegraphCanvas || !flamegraphView) {
        return;
      }

      const physicalDelta = vec2.fromValues(evt.deltaX, evt.deltaY);
      const physicalToConfig = mat3.invert(
        mat3.create(),
        flamegraphView.fromConfigView(flamegraphCanvas.physicalSpace)
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
    },
    [flamegraphCanvas, flamegraphView, canvasPoolManager]
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

      evt.preventDefault();

      // When we zoom, we want to clear cursor so that any tooltips
      // rendered on the flamegraph are removed from the flamegraphView
      setConfigSpaceCursor(null);

      // pinch to zoom is recognized as `ctrlKey + wheelEvent`
      if (evt.metaKey || evt.ctrlKey) {
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
  }, [flamegraphCanvasRef, zoom, scroll]);

  const contextMenu = useContextMenu({container: flamegraphCanvasRef});

  return (
    <CanvasContainer>
      <Canvas
        ref={canvas => setFlamegraphCanvasRef(canvas)}
        onMouseDown={onCanvasMouseDown}
        onMouseUp={onCanvasMouseUp}
        onMouseMove={onCanvasMouseMove}
        onMouseLeave={onCanvasMouseLeave}
        onContextMenu={contextMenu.handleContextMenu}
        style={{cursor: lastInteraction === 'pan' ? 'grab' : 'default'}}
      />
      <Canvas
        ref={canvas => setFlamegraphOverlayCanvasRef(canvas)}
        style={{
          pointerEvents: 'none',
        }}
      />
      <FlamegraphOptionsContextMenu contextMenu={contextMenu} />
      {flamegraphCanvas &&
      flamegraphRenderer &&
      flamegraphView &&
      configSpaceCursor &&
      hoveredNode?.frame?.name ? (
        <BoundTooltip
          bounds={canvasBounds}
          cursor={configSpaceCursor}
          flamegraphCanvas={flamegraphCanvas}
          flamegraphView={flamegraphView}
        >
          <HoveredFrameMainInfo>
            <FrameColorIndicator
              backgroundColor={formatColorForFrame(hoveredNode, flamegraphRenderer)}
            />
            {flamegraphRenderer.flamegraph.formatter(hoveredNode.node.totalWeight)}{' '}
            {formatWeightToProfileDuration(
              hoveredNode.node,
              flamegraphRenderer.flamegraph
            )}{' '}
            {hoveredNode.frame.name}
          </HoveredFrameMainInfo>
          <HoveredFrameTimelineInfo>
            {flamegraphRenderer.flamegraph.timelineFormatter(hoveredNode.start)}{' '}
            {' \u2014 '}
            {flamegraphRenderer.flamegraph.timelineFormatter(hoveredNode.end)}
          </HoveredFrameTimelineInfo>
        </BoundTooltip>
      ) : null}
    </CanvasContainer>
  );
}

const HoveredFrameTimelineInfo = styled('div')`
  color: ${p => p.theme.subText};
`;

const HoveredFrameMainInfo = styled('div')`
  display: flex;
  align-items: center;
`;

const FrameColorIndicator = styled('div')<{
  backgroundColor: React.CSSProperties['backgroundColor'];
}>`
  width: 12px;
  height: 12px;
  min-width: 12px;
  min-height: 12px;
  border-radius: 2px;
  display: inline-block;
  background-color: ${p => p.backgroundColor};
  margin-right: ${space(1)};
`;

const CanvasContainer = styled('div')`
  display: flex;
  flex-direction: column;
  height: 100%;
  position: relative;
`;

const Canvas = styled('canvas')`
  left: 0;
  top: 0;
  width: 100%;
  height: 100%;
  user-select: none;
  position: absolute;
`;

export {FlamegraphZoomView};
