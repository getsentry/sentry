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

import LoadingIndicator from 'sentry/components/loadingIndicator';
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
import {useProfileGroup} from 'sentry/views/profiling/profileGroupProvider';

import {useCanvasScroll} from './interactions/useCanvasScroll';
import {useCanvasZoomOrScroll} from './interactions/useCanvasZoomOrScroll';
import {useInteractionViewCheckPoint} from './interactions/useInteractionViewCheckPoint';
import {useWheelCenterZoom} from './interactions/useWheelCenterZoom';

interface FlamegraphUIFramesProps {
  canvasBounds: Rect;
  canvasPoolManager: CanvasPoolManager;
  flamegraphCanvas: FlamegraphCanvas | null;
  flamegraphCanvasRef: HTMLCanvasElement | null;
  flamegraphView: CanvasView<Flamegraph> | null;
  uiFrames: UIFrames;
}

export function FlamegraphUIFrames({
  uiFrames,
  canvasPoolManager,
  flamegraphView,
  flamegraphCanvas,
  flamegraphCanvasRef,
}: FlamegraphUIFramesProps) {
  const profileGroup = useProfileGroup();
  const flamegraphTheme = useFlamegraphTheme();
  const scheduler = useCanvasScheduler(canvasPoolManager);

  const [configSpaceCursor, setConfigSpaceCursor] = useState<vec2 | null>(null);
  const [startInteractionVector, setStartInteractionVector] = useState<vec2 | null>(null);
  const [lastInteraction, setLastInteraction] = useState<
    'pan' | 'click' | 'zoom' | 'scroll' | 'select' | 'resize' | null
  >(null);

  const selectedUIFrameRef = useRef<UIFrameNode[] | null>(null);

  const uiFramesRenderer = useMemo(() => {
    if (!flamegraphCanvasRef) {
      return null;
    }

    return new UIFramesRenderer(flamegraphCanvasRef, uiFrames, flamegraphTheme);
  }, [flamegraphCanvasRef, uiFrames, flamegraphTheme]);

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
    if (!flamegraphCanvas || !flamegraphView || !uiFramesRenderer) {
      return undefined;
    }

    const drawUIFrames = () => {
      uiFramesRenderer.draw(
        flamegraphView.fromConfigView(flamegraphCanvas.physicalSpace)
      );
    };

    scheduler.registerBeforeFrameCallback(drawUIFrames);

    return () => {
      scheduler.unregisterBeforeFrameCallback(drawUIFrames);
    };
  }, [flamegraphView, flamegraphCanvas, uiFramesRenderer, scheduler]);

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

      const configSpaceMouse = flamegraphView.getTransformedConfigViewCursor(
        vec2.fromValues(evt.nativeEvent.offsetX, evt.nativeEvent.offsetY),
        flamegraphCanvas
      );

      setConfigSpaceCursor(configSpaceMouse);

      if (startInteractionVector) {
        onMouseDrag(evt);
        setLastInteraction('pan');
      } else {
        setLastInteraction(null);
      }
    },
    [flamegraphCanvas, flamegraphView, onMouseDrag, startInteractionVector]
  );

  const onMinimapCanvasMouseUp = useCallback(() => {
    setConfigSpaceCursor(null);
    setLastInteraction(null);
  }, []);

  const onWheelCenterZoom = useWheelCenterZoom(
    flamegraphCanvas,
    flamegraphView,
    canvasPoolManager
  );
  const onCanvasScroll = useCanvasScroll(
    flamegraphCanvas,
    flamegraphView,
    canvasPoolManager
  );

  useCanvasZoomOrScroll({
    setConfigSpaceCursor,
    setLastInteraction,
    handleWheel: onWheelCenterZoom,
    handleScroll: onCanvasScroll,
    canvas: flamegraphCanvasRef,
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
      if (!flamegraphCanvasRef || flamegraphCanvasRef.contains(evt.target as Node)) {
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
        onMouseMove={onCanvasMouseMove}
        onMouseLeave={onCanvasMouseLeave}
        onMouseUp={onCanvasMouseUp}
        onMouseDown={onCanvasMouseDown}
        cursor={lastInteraction === 'pan' ? 'grabbing' : 'default'}
      />
      {/* transaction loads after profile, so we want to show loading even if it's in initial state */}
      {profileGroup.type === 'loading' || profileGroup.type === 'initial' ? (
        <LoadingIndicatorContainer>
          <LoadingIndicator size={42} />
        </LoadingIndicatorContainer>
      ) : profileGroup.type === 'resolved' && uiFrames.frames.length <= 1 ? (
        <MessageContainer>{t('Profile has no dropped frames')}</MessageContainer>
      ) : null}
    </Fragment>
  );
}

const MessageContainer = styled('p')`
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  height: 100%;
  width: 100%;
  position: absolute;
  color: ${p => p.theme.subText};
`;

const LoadingIndicatorContainer = styled('div')`
  position: absolute;
  display: flex;
  flex-direction: column;
  justify-content: center;
  width: 100%;
  height: 100%;
`;

const Canvas = styled('canvas')<{cursor?: CSSProperties['cursor']}>`
  width: 100%;
  height: 100%;
  position: absolute;
  left: 0;
  top: 0;
  user-select: none;
  cursor: ${p => p.cursor};
`;
