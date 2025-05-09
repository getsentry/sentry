import type {CSSProperties} from 'react';
import {Fragment, useCallback, useEffect, useMemo, useState} from 'react';
import styled from '@emotion/styled';
import * as Sentry from '@sentry/react';
import {vec2} from 'gl-matrix';

import {addErrorMessage} from 'sentry/actionCreators/indicator';
import {t} from 'sentry/locale';
import type {RequestState} from 'sentry/types/core';
import type {CanvasPoolManager} from 'sentry/utils/profiling/canvasScheduler';
import {useCanvasScheduler} from 'sentry/utils/profiling/canvasScheduler';
import type {CanvasView} from 'sentry/utils/profiling/canvasView';
import {useFlamegraphTheme} from 'sentry/utils/profiling/flamegraph/useFlamegraphTheme';
import type {FlamegraphCanvas} from 'sentry/utils/profiling/flamegraphCanvas';
import {
  getConfigViewTranslationBetweenVectors,
  getPhysicalSpacePositionFromOffset,
  initializeFlamegraphRenderer,
} from 'sentry/utils/profiling/gl/utils';
import {UIFramesRenderer2D} from 'sentry/utils/profiling/renderers/UIFramesRenderer2D';
import {UIFramesRendererWebGL} from 'sentry/utils/profiling/renderers/uiFramesRendererWebGL';
import type {UIFrameNode, UIFrames} from 'sentry/utils/profiling/uiFrames';

import {useCanvasScroll} from './interactions/useCanvasScroll';
import {useCanvasZoomOrScroll} from './interactions/useCanvasZoomOrScroll';
import {useInteractionViewCheckPoint} from './interactions/useInteractionViewCheckPoint';
import {useWheelCenterZoom} from './interactions/useWheelCenterZoom';
import {
  CollapsibleTimelineLoadingIndicator,
  CollapsibleTimelineMessage,
} from './collapsibleTimeline';
import {FlamegraphUIFramesTooltip} from './flamegraphUIFramesTooltip';

interface FlamegraphUIFramesProps {
  canvasPoolManager: CanvasPoolManager;
  setUIFramesCanvasRef: (ref: HTMLCanvasElement | null) => void;
  status: RequestState<any>['type'];
  uiFrames: UIFrames;
  uiFramesCanvas: FlamegraphCanvas | null;
  uiFramesCanvasRef: HTMLCanvasElement | null;
  uiFramesView: CanvasView<UIFrames> | null;
}

export function FlamegraphUIFrames({
  status,
  uiFrames,
  canvasPoolManager,
  uiFramesView,
  uiFramesCanvasRef,
  uiFramesCanvas,
  setUIFramesCanvasRef,
}: FlamegraphUIFramesProps) {
  const flamegraphTheme = useFlamegraphTheme();
  const scheduler = useCanvasScheduler(canvasPoolManager);

  const [configSpaceCursor, setConfigSpaceCursor] = useState<vec2 | null>(null);
  const [startInteractionVector, setStartInteractionVector] = useState<vec2 | null>(null);
  const [lastInteraction, setLastInteraction] = useState<
    'pan' | 'click' | 'zoom' | 'scroll' | 'select' | 'resize' | null
  >(null);

  const uiFramesRenderer = useMemo(() => {
    if (!uiFramesCanvasRef) {
      return null;
    }

    const renderer = initializeFlamegraphRenderer(
      [UIFramesRendererWebGL, UIFramesRenderer2D],
      [
        uiFramesCanvasRef,
        uiFrames,
        flamegraphTheme,
        {
          draw_border: true,
        },
      ]
    );

    if (renderer === null) {
      Sentry.captureException('Failed to initialize a flamegraph renderer');
      addErrorMessage('Failed to initialize renderer');
      return null;
    }

    return renderer;
  }, [uiFramesCanvasRef, uiFrames, flamegraphTheme]);

  const hoveredNode: UIFrameNode[] | null = useMemo(() => {
    if (!configSpaceCursor || !uiFramesRenderer || !uiFramesView?.configSpace) {
      return null;
    }
    return uiFramesRenderer.findHoveredNode(configSpaceCursor, uiFramesView.configSpace);
  }, [configSpaceCursor, uiFramesRenderer, uiFramesView?.configSpace]);

  useEffect(() => {
    if (!uiFramesCanvas || !uiFramesView || !uiFramesRenderer) {
      return undefined;
    }

    const drawUIFrames = () => {
      uiFramesRenderer.draw(
        uiFramesView.fromTransformedConfigView(uiFramesCanvas.physicalSpace)
      );
    };

    scheduler.registerBeforeFrameCallback(drawUIFrames);
    scheduler.draw();

    return () => {
      scheduler.unregisterBeforeFrameCallback(drawUIFrames);
    };
  }, [uiFramesView, uiFramesCanvas, uiFramesRenderer, scheduler]);

  const onMouseDrag = useCallback(
    (evt: React.MouseEvent<HTMLCanvasElement>) => {
      if (!uiFramesCanvas || !uiFramesView || !startInteractionVector) {
        return;
      }

      const configDelta = getConfigViewTranslationBetweenVectors(
        evt.nativeEvent.offsetX,
        evt.nativeEvent.offsetY,
        startInteractionVector,
        uiFramesView,
        uiFramesCanvas
      );

      if (!configDelta) {
        return;
      }

      canvasPoolManager.dispatch('transform config view', [configDelta, uiFramesView]);
      setStartInteractionVector(
        getPhysicalSpacePositionFromOffset(
          evt.nativeEvent.offsetX,
          evt.nativeEvent.offsetY
        )
      );
    },
    [uiFramesCanvas, uiFramesView, startInteractionVector, canvasPoolManager]
  );

  const onCanvasMouseMove = useCallback(
    (evt: React.MouseEvent<HTMLCanvasElement>) => {
      if (!uiFramesCanvas || !uiFramesView) {
        return;
      }

      const configSpaceMouse = uiFramesView.getTransformedConfigViewCursor(
        vec2.fromValues(evt.nativeEvent.offsetX, evt.nativeEvent.offsetY),
        uiFramesCanvas
      );

      setConfigSpaceCursor(configSpaceMouse);

      if (startInteractionVector) {
        onMouseDrag(evt);
        setLastInteraction('pan');
      } else {
        setLastInteraction(null);
      }
    },
    [uiFramesCanvas, uiFramesView, onMouseDrag, startInteractionVector]
  );

  const onMapCanvasMouseUp = useCallback(() => {
    setConfigSpaceCursor(null);
    setLastInteraction(null);
  }, []);

  const onWheelCenterZoom = useWheelCenterZoom(
    uiFramesCanvas,
    uiFramesView,
    canvasPoolManager
  );
  const onCanvasScroll = useCanvasScroll(uiFramesCanvas, uiFramesView, canvasPoolManager);

  useCanvasZoomOrScroll({
    setConfigSpaceCursor,
    setLastInteraction,
    handleWheel: onWheelCenterZoom,
    handleScroll: onCanvasScroll,
    canvas: uiFramesCanvasRef,
  });

  useInteractionViewCheckPoint({
    view: uiFramesView,
    lastInteraction,
  });

  useEffect(() => {
    window.addEventListener('mouseup', onMapCanvasMouseUp);

    return () => {
      window.removeEventListener('mouseup', onMapCanvasMouseUp);
    };
  }, [onMapCanvasMouseUp]);

  const onCanvasMouseLeave = useCallback(() => {
    setConfigSpaceCursor(null);
    setStartInteractionVector(null);
    setLastInteraction(null);
  }, []);

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

      if (!uiFramesView) {
        return;
      }

      if (!configSpaceCursor) {
        setLastInteraction(null);
        setStartInteractionVector(null);
        return;
      }

      // Only dispatch the zoom action if the new clicked node is not the same as the old selected node.
      // This essentially tracks double click action on a rectangle
      if (lastInteraction === 'click') {
        // if (
        //   hoveredNode &&
        //   selectedUIFrameRef.current?.length === 1 &&
        //   selectedUIFrameRef.current[0] === hoveredNode
        // ) {
        //   selectedUIFrameRef.current = [hoveredNode];
        //   // If double click is fired on a node, then zoom into it
        //   canvasPoolManager.dispatch('set config view', [
        //     new Rect(hoveredNode.start, 0, hoveredNode.duration, 1),
        //     uiFramesView,
        //   ]);
        // }
        // @TODO
        // canvasPoolManager.dispatch('highlight span', [
        //   hoveredNode ? [hoveredNode] : null,
        //   'selected',
        // ]);
      }

      setLastInteraction(null);
      setStartInteractionVector(null);
    },
    [configSpaceCursor, uiFramesView, lastInteraction]
  );

  // When a user click anywhere outside the spans, clear cursor and selected node
  useEffect(() => {
    const onClickOutside = (evt: MouseEvent) => {
      if (!uiFramesCanvasRef || uiFramesCanvasRef.contains(evt.target as Node)) {
        return;
      }
      canvasPoolManager.dispatch('highlight ui frame', [null, 'selected']);
      setConfigSpaceCursor(null);
    };

    document.addEventListener('click', onClickOutside);

    return () => {
      document.removeEventListener('click', onClickOutside);
    };
  });

  return (
    <Fragment>
      <Canvas
        ref={setUIFramesCanvasRef}
        onMouseMove={onCanvasMouseMove}
        onMouseLeave={onCanvasMouseLeave}
        onMouseUp={onCanvasMouseUp}
        onMouseDown={onCanvasMouseDown}
        cursor={lastInteraction === 'pan' ? 'grabbing' : 'default'}
      />
      {hoveredNode &&
      uiFramesRenderer &&
      configSpaceCursor &&
      uiFramesCanvas &&
      uiFramesView ? (
        <FlamegraphUIFramesTooltip
          uiFrames={uiFrames}
          configSpaceCursor={configSpaceCursor}
          uiFramesCanvas={uiFramesCanvas}
          uiFramesView={uiFramesView}
          uiFramesRenderer={uiFramesRenderer}
          hoveredNode={hoveredNode}
        />
      ) : null}
      {/* transaction loads after profile, so we want to show loading even if it's in initial state */}
      {status === 'loading' || status === 'initial' ? (
        <CollapsibleTimelineLoadingIndicator />
      ) : status === 'resolved' && !uiFrames.frames.length ? (
        <CollapsibleTimelineMessage>
          {t('Profile has no dropped or slow frames')}
        </CollapsibleTimelineMessage>
      ) : null}
    </Fragment>
  );
}

const Canvas = styled('canvas')<{cursor?: CSSProperties['cursor']}>`
  width: 100%;
  height: 100%;
  position: absolute;
  left: 0;
  top: 0;
  user-select: none;
  cursor: ${p => p.cursor};
`;
