import {
  CSSProperties,
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import styled from '@emotion/styled';
import {vec2} from 'gl-matrix';

import {t} from 'sentry/locale';
import {
  CanvasPoolManager,
  useCanvasScheduler,
} from 'sentry/utils/profiling/canvasScheduler';
import {CanvasView} from 'sentry/utils/profiling/canvasView';
import {Flamegraph} from 'sentry/utils/profiling/flamegraph';
import {useFlamegraphTheme} from 'sentry/utils/profiling/flamegraph/useFlamegraphTheme';
import {FlamegraphCanvas} from 'sentry/utils/profiling/flamegraphCanvas';
import {
  getConfigViewTranslationBetweenVectors,
  getPhysicalSpacePositionFromOffset,
  Rect,
} from 'sentry/utils/profiling/gl/utils';
import {UIFramesRenderer} from 'sentry/utils/profiling/renderers/uiFramesRenderer';
import {UIFrameNode, UIFrames} from 'sentry/utils/profiling/uiFrames';
import {useDevicePixelRatio} from 'sentry/utils/useDevicePixelRatio';
import {useProfileGroup} from 'sentry/views/profiling/profileGroupProvider';

import {useCanvasScroll} from './interactions/useCanvasScroll';
import {useCanvasZoomOrScroll} from './interactions/useCanvasZoomOrScroll';
import {useInteractionViewCheckPoint} from './interactions/useInteractionViewCheckPoint';
import {useWheelCenterZoom} from './interactions/useWheelCenterZoom';
import {
  CollapsibleTimelineLoadingIndicator,
  CollapsibleTimelineMessage,
} from './collapsibleTimeline';

interface FlamegraphUIFramesProps {
  canvasBounds: Rect;
  canvasPoolManager: CanvasPoolManager;
  flamegraphView: CanvasView<Flamegraph> | null;
  uiFrames: UIFrames;
}

export function FlamegraphUIFrames({
  uiFrames,
  canvasPoolManager,
  flamegraphView,
}: FlamegraphUIFramesProps) {
  const devicePixelRatio = useDevicePixelRatio();
  const profileGroup = useProfileGroup();
  const flamegraphTheme = useFlamegraphTheme();
  const scheduler = useCanvasScheduler(canvasPoolManager);
  const [uiFramesCanvasRef, setUIFramesCanvasRef] = useState<HTMLCanvasElement | null>(
    null
  );

  const [configSpaceCursor, setConfigSpaceCursor] = useState<vec2 | null>(null);
  const [startInteractionVector, setStartInteractionVector] = useState<vec2 | null>(null);
  const [lastInteraction, setLastInteraction] = useState<
    'pan' | 'click' | 'zoom' | 'scroll' | 'select' | 'resize' | null
  >(null);

  const selectedUIFrameRef = useRef<UIFrameNode[] | null>(null);

  const uiFramesCanvas = useMemo(() => {
    if (!uiFramesCanvasRef) {
      return null;
    }
    return new FlamegraphCanvas(
      uiFramesCanvasRef,
      vec2.fromValues(0, flamegraphTheme.SIZES.TIMELINE_HEIGHT * devicePixelRatio)
    );
  }, [devicePixelRatio, uiFramesCanvasRef, flamegraphTheme]);

  const uiFramesRenderer = useMemo(() => {
    if (!uiFramesCanvasRef) {
      return null;
    }

    return new UIFramesRenderer(uiFramesCanvasRef, uiFrames, flamegraphTheme);
  }, [uiFramesCanvasRef, uiFrames, flamegraphTheme]);

  const hoveredNode: UIFrameNode | null = useMemo(() => {
    if (!configSpaceCursor || !uiFramesRenderer || !flamegraphView?.configSpace) {
      return null;
    }
    return uiFramesRenderer.findHoveredNode(
      configSpaceCursor,
      flamegraphView.configSpace
    );
  }, [configSpaceCursor, uiFramesRenderer, flamegraphView?.configSpace]);

  useEffect(() => {
    if (!uiFramesCanvas || !flamegraphView || !uiFramesRenderer) {
      return undefined;
    }

    const drawUIFrames = () => {
      uiFramesRenderer.draw(
        flamegraphView.fromTransformedConfigView(uiFramesCanvas.physicalSpace)
      );
    };

    scheduler.registerBeforeFrameCallback(drawUIFrames);
    scheduler.draw();

    return () => {
      scheduler.unregisterBeforeFrameCallback(drawUIFrames);
    };
  }, [flamegraphView, uiFramesCanvas, uiFramesRenderer, scheduler]);

  const onMouseDrag = useCallback(
    (evt: React.MouseEvent<HTMLCanvasElement>) => {
      if (!uiFramesCanvas || !flamegraphView || !startInteractionVector) {
        return;
      }

      const configDelta = getConfigViewTranslationBetweenVectors(
        evt.nativeEvent.offsetX,
        evt.nativeEvent.offsetY,
        startInteractionVector,
        flamegraphView,
        uiFramesCanvas
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
    [uiFramesCanvas, flamegraphView, startInteractionVector, canvasPoolManager]
  );

  const onCanvasMouseMove = useCallback(
    (evt: React.MouseEvent<HTMLCanvasElement>) => {
      if (!uiFramesCanvas || !flamegraphView) {
        return;
      }

      const configSpaceMouse = flamegraphView.getTransformedConfigViewCursor(
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
    [uiFramesCanvas, flamegraphView, onMouseDrag, startInteractionVector]
  );

  const onMinimapCanvasMouseUp = useCallback(() => {
    setConfigSpaceCursor(null);
    setLastInteraction(null);
  }, []);

  const onWheelCenterZoom = useWheelCenterZoom(
    uiFramesCanvas,
    flamegraphView,
    canvasPoolManager
  );
  const onCanvasScroll = useCanvasScroll(
    uiFramesCanvas,
    flamegraphView,
    canvasPoolManager
  );

  useCanvasZoomOrScroll({
    setConfigSpaceCursor,
    setLastInteraction,
    handleWheel: onWheelCenterZoom,
    handleScroll: onCanvasScroll,
    canvas: uiFramesCanvasRef,
  });

  useInteractionViewCheckPoint({
    view: flamegraphView,
    lastInteraction,
  });

  useEffect(() => {
    window.addEventListener('mouseup', onMinimapCanvasMouseUp);

    return () => {
      window.removeEventListener('mouseup', onMinimapCanvasMouseUp);
    };
  }, [onMinimapCanvasMouseUp]);

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

      if (!flamegraphView) {
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
        if (
          hoveredNode &&
          selectedUIFrameRef.current?.length === 1 &&
          selectedUIFrameRef.current[0] === hoveredNode
        ) {
          selectedUIFrameRef.current = [hoveredNode];
          // If double click is fired on a node, then zoom into it
          canvasPoolManager.dispatch('set config view', [
            new Rect(hoveredNode.start, 0, hoveredNode.duration, 1),
            flamegraphView,
          ]);
        }

        // @TODO
        // canvasPoolManager.dispatch('highlight span', [
        //   hoveredNode ? [hoveredNode] : null,
        //   'selected',
        // ]);
      }

      setLastInteraction(null);
      setStartInteractionVector(null);
    },
    [configSpaceCursor, hoveredNode, flamegraphView, canvasPoolManager, lastInteraction]
  );

  // When a user click anywhere outside the spans, clear cursor and selected node
  useEffect(() => {
    const onClickOutside = (evt: MouseEvent) => {
      if (!uiFramesCanvasRef || uiFramesCanvasRef.contains(evt.target as Node)) {
        return;
      }
      canvasPoolManager.dispatch('highlight span', [null, 'selected']);
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
      {/* transaction loads after profile, so we want to show loading even if it's in initial state */}
      {profileGroup.type === 'loading' || profileGroup.type === 'initial' ? (
        <CollapsibleTimelineLoadingIndicator />
      ) : profileGroup.type === 'resolved' && uiFrames.frames.length <= 1 ? (
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
