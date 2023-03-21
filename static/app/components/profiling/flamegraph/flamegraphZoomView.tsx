import {CSSProperties, useCallback, useEffect, useMemo, useRef, useState} from 'react';
import styled from '@emotion/styled';
import {vec2} from 'gl-matrix';

import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import {FlamegraphContextMenu} from 'sentry/components/profiling/flamegraph/flamegraphContextMenu';
import {FlamegraphTooltip} from 'sentry/components/profiling/flamegraph/flamegraphTooltip';
import {t} from 'sentry/locale';
import {
  CanvasPoolManager,
  useCanvasScheduler,
} from 'sentry/utils/profiling/canvasScheduler';
import {CanvasView} from 'sentry/utils/profiling/canvasView';
import {DifferentialFlamegraph} from 'sentry/utils/profiling/differentialFlamegraph';
import {Flamegraph} from 'sentry/utils/profiling/flamegraph';
import {handleFlamegraphKeyboardNavigation} from 'sentry/utils/profiling/flamegraph/flamegraphKeyboardNavigation';
import {useFlamegraphSearch} from 'sentry/utils/profiling/flamegraph/hooks/useFlamegraphSearch';
import {
  useDispatchFlamegraphState,
  useFlamegraphState,
} from 'sentry/utils/profiling/flamegraph/hooks/useFlamegraphState';
import {useFlamegraphTheme} from 'sentry/utils/profiling/flamegraph/useFlamegraphTheme';
import {FlamegraphCanvas} from 'sentry/utils/profiling/flamegraphCanvas';
import {FlamegraphFrame} from 'sentry/utils/profiling/flamegraphFrame';
import {
  computeMinZoomConfigViewForFrames,
  getConfigViewTranslationBetweenVectors,
  getPhysicalSpacePositionFromOffset,
  Rect,
} from 'sentry/utils/profiling/gl/utils';
import {useContextMenu} from 'sentry/utils/profiling/hooks/useContextMenu';
import {useInternalFlamegraphDebugMode} from 'sentry/utils/profiling/hooks/useInternalFlamegraphDebugMode';
import {FlamegraphRenderer} from 'sentry/utils/profiling/renderers/flamegraphRenderer';
import {FlamegraphTextRenderer} from 'sentry/utils/profiling/renderers/flamegraphTextRenderer';
import {GridRenderer} from 'sentry/utils/profiling/renderers/gridRenderer';
import {SampleTickRenderer} from 'sentry/utils/profiling/renderers/sampleTickRenderer';
import {SelectedFrameRenderer} from 'sentry/utils/profiling/renderers/selectedFrameRenderer';
import {useProfileGroup} from 'sentry/views/profiling/profileGroupProvider';

import {useCanvasScroll} from './interactions/useCanvasScroll';
import {useCanvasZoomOrScroll} from './interactions/useCanvasZoomOrScroll';
import {useDrawHoveredBorderEffect} from './interactions/useDrawHoveredBorderEffect';
import {useDrawSelectedBorderEffect} from './interactions/useDrawSelectedBorderEffect';
import {useInteractionViewCheckPoint} from './interactions/useInteractionViewCheckPoint';
import {useWheelCenterZoom} from './interactions/useWheelCenterZoom';

function isHighlightingAllOccurences(
  node: FlamegraphFrame | null,
  selectedNodes: FlamegraphFrame[] | null
) {
  return !!(
    selectedNodes &&
    node &&
    selectedNodes.length > 1 &&
    selectedNodes.includes(node)
  );
}

interface FlamegraphZoomViewProps {
  canvasBounds: Rect;
  canvasPoolManager: CanvasPoolManager;
  flamegraph: Flamegraph | DifferentialFlamegraph;
  flamegraphCanvas: FlamegraphCanvas | null;
  flamegraphCanvasRef: HTMLCanvasElement | null;
  flamegraphOverlayCanvasRef: HTMLCanvasElement | null;
  flamegraphRenderer: FlamegraphRenderer | null;
  flamegraphView: CanvasView<Flamegraph> | null;
  setFlamegraphCanvasRef: React.Dispatch<React.SetStateAction<HTMLCanvasElement | null>>;
  setFlamegraphOverlayCanvasRef: React.Dispatch<
    React.SetStateAction<HTMLCanvasElement | null>
  >;
  disableCallOrderSort?: boolean;
  disableGrid?: boolean;
  disablePanX?: boolean;
  disableZoom?: boolean;
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
  disablePanX = false,
  disableZoom = false,
  disableGrid = false,
  disableCallOrderSort = false,
}: FlamegraphZoomViewProps): React.ReactElement {
  const flamegraphTheme = useFlamegraphTheme();
  const profileGroup = useProfileGroup();
  const flamegraphSearch = useFlamegraphSearch();
  const isInternalFlamegraphDebugModeEnabled = useInternalFlamegraphDebugMode();

  const [lastInteraction, setLastInteraction] = useState<
    'pan' | 'click' | 'zoom' | 'scroll' | 'select' | 'resize' | null
  >(null);

  const dispatch = useDispatchFlamegraphState();
  const scheduler = useCanvasScheduler(canvasPoolManager);

  const canvasContainerRef = useRef<HTMLDivElement | null>(null);
  const [flamegraphState, {previousState, nextState}] = useFlamegraphState();
  const [startInteractionVector, setStartInteractionVector] = useState<vec2 | null>(null);
  const [configSpaceCursor, setConfigSpaceCursor] = useState<vec2 | null>(null);

  const textRenderer: FlamegraphTextRenderer | null = useMemo(() => {
    if (!flamegraphOverlayCanvasRef) {
      return null;
    }
    return new FlamegraphTextRenderer(
      flamegraphOverlayCanvasRef,
      flamegraphTheme,
      flamegraph
    );
  }, [flamegraph, flamegraphOverlayCanvasRef, flamegraphTheme]);

  const gridRenderer: GridRenderer | null = useMemo(() => {
    if (!flamegraphOverlayCanvasRef || disableGrid) {
      return null;
    }
    return new GridRenderer(
      flamegraphOverlayCanvasRef,
      flamegraphTheme,
      flamegraph.formatter
    );
  }, [flamegraphOverlayCanvasRef, flamegraph, flamegraphTheme, disableGrid]);

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
    return flamegraphRenderer.findHoveredNode(configSpaceCursor);
  }, [configSpaceCursor, flamegraphRenderer]);

  useEffect(() => {
    if (!flamegraphRenderer) {
      return;
    }
    flamegraphRenderer.setSearchResults(
      flamegraphSearch.query,
      flamegraphSearch.results.frames
    );
  }, [flamegraphRenderer, flamegraphSearch.query, flamegraphSearch.results]);

  useEffect(() => {
    if (!flamegraphCanvas || !flamegraphView || !textRenderer || !flamegraphRenderer) {
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
        flamegraphView.toOriginConfigView(flamegraphView.configView),
        flamegraphView.fromTransformedConfigView(flamegraphCanvas.physicalSpace),
        flamegraphSearch.results.frames
      );
    };

    const drawInternalSampleTicks = () => {
      if (!sampleTickRenderer) {
        return;
      }
      sampleTickRenderer.draw(
        flamegraphView.fromTransformedConfigView(flamegraphCanvas.physicalSpace),
        flamegraphView.configView
      );
    };

    const drawGrid = gridRenderer
      ? () => {
          gridRenderer.draw(
            flamegraphView.configView,
            flamegraphCanvas.physicalSpace,
            flamegraphView.fromConfigView(flamegraphCanvas.physicalSpace),
            flamegraphView.toConfigView(flamegraphCanvas.logicalSpace),
            flamegraph.profile.type === 'flamechart'
          );
        }
      : undefined;

    const drawRectangles = () => {
      flamegraphRenderer.draw(
        flamegraphView.fromTransformedConfigView(flamegraphCanvas.physicalSpace)
      );
    };

    scheduler.registerBeforeFrameCallback(drawRectangles);
    scheduler.registerBeforeFrameCallback(clearOverlayCanvas);
    scheduler.registerAfterFrameCallback(drawText);
    // We want to register the grid as the last frame callback so that it is drawn on top of everything else,
    // including text, hovered or clicked nodes, but after the sample tick renderer as those are overlaid on top of it
    if (drawGrid) {
      scheduler.registerAfterFrameCallback(drawGrid);
    }
    scheduler.registerAfterFrameCallback(drawInternalSampleTicks);

    scheduler.draw();

    return () => {
      scheduler.unregisterBeforeFrameCallback(clearOverlayCanvas);
      scheduler.unregisterAfterFrameCallback(drawText);
      scheduler.unregisterAfterFrameCallback(drawInternalSampleTicks);
      if (drawGrid) {
        scheduler.unregisterAfterFrameCallback(drawGrid);
      }
      scheduler.unregisterBeforeFrameCallback(drawRectangles);
    };
  }, [
    flamegraphCanvas,
    flamegraphView,
    scheduler,
    flamegraph,
    flamegraphTheme,
    textRenderer,
    gridRenderer,
    flamegraphRenderer,
    sampleTickRenderer,
    canvasPoolManager,
    flamegraphSearch.results.frames,
  ]);

  const selectedFramesRef = useRef<FlamegraphFrame[] | null>(null);

  useEffect(() => {
    if (flamegraphState.profiles.highlightFrames) {
      let frames = flamegraph.findAllMatchingFrames(
        flamegraphState.profiles.highlightFrames.name,
        flamegraphState.profiles.highlightFrames.package
      );

      // there is a chance that the reason we did not find any frames is because
      // for node, we try to infer some package from the frontend code.
      // If that happens, we'll try and just do a search by name. This logic
      // is duplicated in flamegraph.tsx and should be kept in sync
      if (
        !frames.length &&
        !flamegraphState.profiles.highlightFrames.package &&
        flamegraphState.profiles.highlightFrames.name
      ) {
        frames = flamegraph.findAllMatchingFramesBy(
          flamegraphState.profiles.highlightFrames.name,
          ['name']
        );
      }
      selectedFramesRef.current = frames;
    } else {
      selectedFramesRef.current = null;
    }

    if (flamegraphRenderer) {
      flamegraphRenderer?.setHighlightedFrames(selectedFramesRef.current);
    }
  }, [flamegraph, flamegraphRenderer, flamegraphState.profiles.highlightFrames]);

  useInteractionViewCheckPoint({
    view: flamegraphView,
    lastInteraction,
  });

  useDrawSelectedBorderEffect({
    scheduler,
    selectedRef: selectedFramesRef,
    canvas: flamegraphCanvas,
    view: flamegraphView,
    eventKey: 'highlight frame',
    theme: flamegraphTheme,
    renderer: selectedFrameRenderer,
  });

  useDrawHoveredBorderEffect({
    scheduler,
    hoveredNode,
    canvas: flamegraphCanvas,
    view: flamegraphView,
    theme: flamegraphTheme,
    renderer: selectedFrameRenderer,
  });

  useEffect(() => {
    if (!flamegraphCanvas || !flamegraphView) {
      return undefined;
    }

    const onResetZoom = () => {
      setConfigSpaceCursor(null);
    };

    const onZoomIntoFrame = (frame: FlamegraphFrame, _strategy: 'min' | 'exact') => {
      if (frame) {
        selectedFramesRef.current = [frame];
      }
      setConfigSpaceCursor(null);
    };

    scheduler.on('reset zoom', onResetZoom);
    scheduler.on('zoom at frame', onZoomIntoFrame);

    return () => {
      scheduler.off('reset zoom', onResetZoom);
      scheduler.off('zoom at frame', onZoomIntoFrame);
    };
  }, [flamegraphCanvas, canvasPoolManager, dispatch, scheduler, flamegraphView]);

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
              previousPosition,
              flamegraphView,
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
            canvasPoolManager.dispatch('set config view', [nextPosition, flamegraphView]);
          }
        }

        dispatch({type: action});
      }

      if (evt.target === flamegraphCanvasRef) {
        const nextSelected = handleFlamegraphKeyboardNavigation(
          evt,
          selectedFramesRef.current?.[0],
          flamegraph.inverted
        );

        if (nextSelected) {
          canvasPoolManager.dispatch('zoom at frame', [nextSelected, 'min']);
        }
      }
    };

    document.addEventListener('keydown', onKeyDown);

    return () => {
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [
    canvasPoolManager,
    dispatch,
    nextState,
    previousState,
    flamegraphView,
    scheduler,
    flamegraphCanvasRef,
    flamegraph.inverted,
  ]);

  const onCanvasMouseDown = useCallback((evt: React.MouseEvent<HTMLCanvasElement>) => {
    setLastInteraction('click');
    setStartInteractionVector(
      getPhysicalSpacePositionFromOffset(evt.nativeEvent.offsetX, evt.nativeEvent.offsetY)
    );
  }, []);

  const onCanvasMouseUp = useCallback(
    (evt: React.MouseEvent<HTMLCanvasElement>) => {
      evt.preventDefault();
      evt.stopPropagation();

      if (!configSpaceCursor) {
        setLastInteraction(null);
        setStartInteractionVector(null);
        return;
      }

      // Only dispatch the zoom action if the new clicked node is not the same as the old selected node.
      // This essentially tracks double click action on a rectangle
      if (lastInteraction === 'click') {
        if (
          hoveredNode &&
          selectedFramesRef.current?.length === 1 &&
          selectedFramesRef.current[0] === hoveredNode
        ) {
          // If double click is fired on a node, then zoom into it
          canvasPoolManager.dispatch('zoom at frame', [hoveredNode, 'exact']);
          canvasPoolManager.dispatch('show in table view', [hoveredNode]);
        }

        dispatch({
          type: 'set highlight all frames',
          payload: null,
        });
        canvasPoolManager.dispatch('highlight frame', [
          hoveredNode ? [hoveredNode] : null,
          'selected',
        ]);
      }

      setLastInteraction(null);
      setStartInteractionVector(null);
    },
    [configSpaceCursor, dispatch, hoveredNode, canvasPoolManager, lastInteraction]
  );

  const onMouseDrag = useCallback(
    (evt: React.MouseEvent<HTMLCanvasElement>) => {
      if (!flamegraphCanvas || !flamegraphView || !startInteractionVector) {
        return;
      }
      const configDelta = getConfigViewTranslationBetweenVectors(
        evt.nativeEvent.offsetX,
        evt.nativeEvent.offsetY,
        startInteractionVector,
        flamegraphView,
        flamegraphCanvas
      );

      if (!configDelta) {
        return;
      }

      canvasPoolManager.dispatch('transform config view', [configDelta, flamegraphView]);
      setStartInteractionVector(
        getPhysicalSpacePositionFromOffset(
          evt.nativeEvent.offsetX,
          evt.nativeEvent.offsetY
        )
      );
    },
    [flamegraphCanvas, flamegraphView, startInteractionVector, canvasPoolManager]
  );

  const onCanvasMouseMove = useCallback(
    (evt: React.MouseEvent<HTMLCanvasElement>) => {
      if (!flamegraphCanvas || !flamegraphView) {
        return;
      }

      setConfigSpaceCursor(
        flamegraphView.getTransformedConfigViewCursor(
          vec2.fromValues(evt.nativeEvent.offsetX, evt.nativeEvent.offsetY),
          flamegraphCanvas
        )
      );

      if (startInteractionVector) {
        onMouseDrag(evt);
        setLastInteraction('pan');
      } else {
        setLastInteraction(null);
      }
    },
    [
      flamegraphCanvas,
      flamegraphView,
      setConfigSpaceCursor,
      onMouseDrag,
      startInteractionVector,
    ]
  );

  const onCanvasMouseLeave = useCallback(() => {
    setConfigSpaceCursor(null);
    setStartInteractionVector(null);
    setLastInteraction(null);
  }, []);

  const onWheelCenterZoom = useWheelCenterZoom(
    flamegraphCanvas,
    flamegraphView,
    canvasPoolManager,
    disableZoom
  );
  const onCanvasScroll = useCanvasScroll(
    flamegraphCanvas,
    flamegraphView,
    canvasPoolManager,
    disablePanX
  );

  useCanvasZoomOrScroll({
    setConfigSpaceCursor,
    setLastInteraction,
    handleWheel: onWheelCenterZoom,
    handleScroll: onCanvasScroll,
    canvas: flamegraphCanvasRef,
  });

  // When a user click anywhere outside the spans, clear cursor and selected node
  useEffect(() => {
    const onClickOutside = (evt: MouseEvent) => {
      if (
        !canvasContainerRef.current ||
        canvasContainerRef.current.contains(evt.target as Node)
      ) {
        return;
      }
      canvasPoolManager.dispatch('highlight frame', [null, 'selected']);
      setConfigSpaceCursor(null);
    };

    document.addEventListener('click', onClickOutside);

    return () => {
      document.removeEventListener('click', onClickOutside);
    };
  });

  const hoveredNodeOnContextMenuOpen = useRef<FlamegraphFrame | null>(null);
  const contextMenu = useContextMenu({container: flamegraphCanvasRef});
  const [highlightingAllOccurences, setHighlightingAllOccurences] = useState(
    isHighlightingAllOccurences(hoveredNode, selectedFramesRef.current)
  );

  const handleContextMenuOpen = useCallback(
    (event: React.MouseEvent) => {
      hoveredNodeOnContextMenuOpen.current = hoveredNode;
      contextMenu.handleContextMenu(event);
      // Make sure we set the highlight state relative to the newly hovered node
      setHighlightingAllOccurences(
        isHighlightingAllOccurences(hoveredNode, selectedFramesRef.current)
      );
    },
    [contextMenu, hoveredNode]
  );

  const handleHighlightAllFramesClick = useCallback(() => {
    if (!hoveredNodeOnContextMenuOpen.current || !flamegraphView) {
      return;
    }

    // If all occurences are currently being highlighted, we want to unhighlight them now
    if (
      isHighlightingAllOccurences(
        hoveredNodeOnContextMenuOpen.current,
        selectedFramesRef.current
      )
    ) {
      setHighlightingAllOccurences(false);
      dispatch({type: 'set highlight all frames', payload: null});
      canvasPoolManager.dispatch('highlight frame', [null, 'selected']);
      return;
    }

    setHighlightingAllOccurences(true);

    const frameName = hoveredNodeOnContextMenuOpen.current.frame.name;
    const packageName =
      hoveredNodeOnContextMenuOpen.current.frame.package ??
      hoveredNodeOnContextMenuOpen.current.frame.module ??
      '';

    dispatch({
      type: 'set highlight all frames',
      payload: {
        name: frameName,
        package: packageName,
      },
    });

    const frames = flamegraph.findAllMatchingFrames(frameName, packageName);
    const rectFrames = frames.map(f => new Rect(f.start, f.depth, f.end - f.start, 1));
    const newConfigView = computeMinZoomConfigViewForFrames(
      flamegraphView.configView,
      rectFrames
    );

    canvasPoolManager.dispatch('highlight frame', [frames, 'selected']);
    canvasPoolManager.dispatch('set config view', [newConfigView, flamegraphView]);
  }, [canvasPoolManager, flamegraph, flamegraphView, dispatch]);

  const handleCopyFunctionName = useCallback(() => {
    if (!hoveredNodeOnContextMenuOpen.current) {
      return;
    }

    navigator.clipboard
      .writeText(hoveredNodeOnContextMenuOpen.current.frame.name)
      .then(() => {
        addSuccessMessage(t('Function name copied to clipboard'));
      })
      .catch(() => {
        addErrorMessage(t('Failed to copy function name to clipboard'));
      });
  }, []);

  return (
    <CanvasContainer ref={canvasContainerRef}>
      <Canvas
        ref={setFlamegraphCanvasRef}
        onMouseDown={onCanvasMouseDown}
        onMouseUp={onCanvasMouseUp}
        onMouseMove={onCanvasMouseMove}
        onMouseLeave={onCanvasMouseLeave}
        onContextMenu={handleContextMenuOpen}
        cursor={lastInteraction === 'pan' ? 'grabbing' : 'default'}
        tabIndex={1}
      />
      <Canvas ref={setFlamegraphOverlayCanvasRef} pointerEvents="none" />
      <FlamegraphContextMenu
        contextMenu={contextMenu}
        profileGroup={profileGroup}
        hoveredNode={hoveredNodeOnContextMenuOpen.current}
        isHighlightingAllOccurences={highlightingAllOccurences}
        onCopyFunctionNameClick={handleCopyFunctionName}
        onHighlightAllOccurencesClick={handleHighlightAllFramesClick}
        disableCallOrderSort={disableCallOrderSort}
      />
      {flamegraphCanvas &&
      flamegraphRenderer &&
      flamegraphView &&
      configSpaceCursor &&
      hoveredNode ? (
        <FlamegraphTooltip
          frame={hoveredNode}
          configSpaceCursor={configSpaceCursor}
          flamegraphCanvas={flamegraphCanvas}
          flamegraphRenderer={flamegraphRenderer}
          flamegraphView={flamegraphView}
          canvasBounds={canvasBounds}
          platform={profileGroup.metadata.platform}
        />
      ) : null}
    </CanvasContainer>
  );
}

const CanvasContainer = styled('div')`
  display: flex;
  flex-direction: column;
  height: 100%;
  width: 100%;
  position: relative;
`;

const Canvas = styled('canvas')<{
  cursor?: CSSProperties['cursor'];
  pointerEvents?: CSSProperties['pointerEvents'];
}>`
  left: 0;
  top: 0;
  width: 100%;
  height: 100%;
  user-select: none;
  position: absolute;
  pointer-events: ${p => p.pointerEvents || 'auto'};
  cursor: ${p => p.cursor || 'default'};

  &:focus {
    outline: none;
  }
`;

export {FlamegraphZoomView};
