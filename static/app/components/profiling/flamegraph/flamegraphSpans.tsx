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
import {BoundTooltip} from 'sentry/components/profiling/boundTooltip';
import {t} from 'sentry/locale';
import {
  CanvasPoolManager,
  useCanvasScheduler,
} from 'sentry/utils/profiling/canvasScheduler';
import {CanvasView} from 'sentry/utils/profiling/canvasView';
import {useFlamegraphTheme} from 'sentry/utils/profiling/flamegraph/useFlamegraphTheme';
import {FlamegraphCanvas} from 'sentry/utils/profiling/flamegraphCanvas';
import {
  formatColorForSpan,
  getConfigViewTranslationBetweenVectors,
  getPhysicalSpacePositionFromOffset,
  Rect,
} from 'sentry/utils/profiling/gl/utils';
import {SelectedFrameRenderer} from 'sentry/utils/profiling/renderers/selectedFrameRenderer';
import {SpanChartRenderer2D} from 'sentry/utils/profiling/renderers/spansRenderer';
import {SpanChart, SpanChartNode} from 'sentry/utils/profiling/spanChart';
import {useProfileTransaction} from 'sentry/views/profiling/profileGroupProvider';

import {useCanvasScroll} from './interactions/useCanvasScroll';
import {useCanvasZoomOrScroll} from './interactions/useCanvasZoomOrScroll';
import {useDrawHoveredBorderEffect} from './interactions/useDrawHoveredBorderEffect';
import {useDrawSelectedBorderEffect} from './interactions/useDrawSelectedBorderEffect';
import {useInteractionViewCheckPoint} from './interactions/useInteractionViewCheckPoint';
import {useWheelCenterZoom} from './interactions/useWheelCenterZoom';
import {
  FlamegraphTooltipColorIndicator,
  FlamegraphTooltipFrameMainInfo,
  FlamegraphTooltipTimelineInfo,
} from './flamegraphTooltip';

export function formatWeightToTransactionDuration(
  span: SpanChartNode,
  spanChart: SpanChart
) {
  return `(${Math.round((span.duration / spanChart.root.duration) * 100)}%)`;
}

interface FlamegraphSpansProps {
  canvasBounds: Rect;
  canvasPoolManager: CanvasPoolManager;
  setSpansCanvasRef: React.Dispatch<React.SetStateAction<HTMLCanvasElement | null>>;
  spanChart: SpanChart;
  spansCanvas: FlamegraphCanvas | null;
  spansCanvasRef: HTMLCanvasElement | null;
  spansView: CanvasView<SpanChart> | null;
}

export function FlamegraphSpans({
  spanChart,
  canvasPoolManager,
  canvasBounds,
  spansView,
  spansCanvas,
  spansCanvasRef,
  setSpansCanvasRef,
}: FlamegraphSpansProps) {
  const flamegraphTheme = useFlamegraphTheme();
  const scheduler = useCanvasScheduler(canvasPoolManager);
  const profiledTransaction = useProfileTransaction();

  const [configSpaceCursor, setConfigSpaceCursor] = useState<vec2 | null>(null);
  const [startInteractionVector, setStartInteractionVector] = useState<vec2 | null>(null);
  const [lastInteraction, setLastInteraction] = useState<
    'pan' | 'click' | 'zoom' | 'scroll' | 'select' | 'resize' | null
  >(null);

  const selectedSpansRef = useRef<SpanChartNode[] | null>(null);

  const spansRenderer = useMemo(() => {
    if (!spansCanvasRef) {
      return null;
    }

    return new SpanChartRenderer2D(spansCanvasRef, spanChart, flamegraphTheme);
  }, [spansCanvasRef, spanChart, flamegraphTheme]);

  const selectedSpanRenderer = useMemo(() => {
    if (!spansCanvasRef) {
      return null;
    }

    return new SelectedFrameRenderer(spansCanvasRef);
  }, [spansCanvasRef]);

  const hoveredNode: SpanChartNode | null = useMemo(() => {
    if (!configSpaceCursor || !spansRenderer) {
      return null;
    }
    return spansRenderer.findHoveredNode(configSpaceCursor);
  }, [configSpaceCursor, spansRenderer]);

  useEffect(() => {
    if (!spansCanvas || !spansView || !spansRenderer) {
      return undefined;
    }

    if (profiledTransaction.type !== 'resolved') {
      return undefined;
    }

    const drawSpans = () => {
      spansRenderer.draw(
        spansView.configView.transformRect(spansView.configSpaceTransform),
        spansView.fromConfigView(spansCanvas.physicalSpace)
      );
    };

    drawSpans();
    scheduler.registerBeforeFrameCallback(drawSpans);

    return () => {
      scheduler.unregisterBeforeFrameCallback(drawSpans);
    };
  }, [spansCanvas, spansRenderer, scheduler, spansView, profiledTransaction.type]);

  const onMouseDrag = useCallback(
    (evt: React.MouseEvent<HTMLCanvasElement>) => {
      if (!spansCanvas || !spansView || !startInteractionVector) {
        return;
      }

      const configDelta = getConfigViewTranslationBetweenVectors(
        evt.nativeEvent.offsetX,
        evt.nativeEvent.offsetY,
        startInteractionVector,
        spansView,
        spansCanvas
      );

      if (!configDelta) {
        return;
      }

      canvasPoolManager.dispatch('transform config view', [configDelta]);
      setStartInteractionVector(
        getPhysicalSpacePositionFromOffset(
          evt.nativeEvent.offsetX,
          evt.nativeEvent.offsetY
        )
      );
    },
    [spansCanvas, spansView, startInteractionVector, canvasPoolManager]
  );

  const onCanvasMouseMove = useCallback(
    (evt: React.MouseEvent<HTMLCanvasElement>) => {
      if (!spansCanvas || !spansView) {
        return;
      }

      const configSpaceMouse = spansView.getTransformedConfigViewCursor(
        vec2.fromValues(evt.nativeEvent.offsetX, evt.nativeEvent.offsetY),
        spansCanvas
      );

      setConfigSpaceCursor(configSpaceMouse);

      if (startInteractionVector) {
        onMouseDrag(evt);
        setLastInteraction('pan');
      } else {
        setLastInteraction(null);
      }
    },
    [spansCanvas, spansView, onMouseDrag, startInteractionVector]
  );

  const onMinimapCanvasMouseUp = useCallback(() => {
    setConfigSpaceCursor(null);
    setLastInteraction(null);
  }, []);

  const onWheelCenterZoom = useWheelCenterZoom(spansCanvas, spansView, canvasPoolManager);
  const onCanvasScroll = useCanvasScroll(spansCanvas, spansView, canvasPoolManager);

  useCanvasZoomOrScroll({
    lastInteraction,
    configSpaceCursor,
    setConfigSpaceCursor,
    setLastInteraction,
    handleWheel: onWheelCenterZoom,
    handleScroll: onCanvasScroll,
    canvas: spansCanvasRef,
  });

  useDrawSelectedBorderEffect({
    scheduler,
    selectedRef: selectedSpansRef,
    canvas: spansCanvas,
    view: spansView,
    eventKey: 'highlight span',
    theme: flamegraphTheme,
    renderer: selectedSpanRenderer,
  });

  useDrawHoveredBorderEffect({
    scheduler,
    hoveredNode,
    canvas: spansCanvas,
    view: spansView,
    theme: flamegraphTheme,
    renderer: selectedSpanRenderer,
  });

  useInteractionViewCheckPoint({
    view: spansView,
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
          selectedSpansRef.current?.length === 1 &&
          selectedSpansRef.current[0] === hoveredNode
        ) {
          selectedSpansRef.current = [hoveredNode];
          // If double click is fired on a node, then zoom into it
          canvasPoolManager.dispatch('set config view', [
            // nextPosition.withHeight(flamegraphView.configView.height),
            new Rect(hoveredNode.start, 0, hoveredNode.duration, 1),
          ]);
        }

        canvasPoolManager.dispatch('highlight span', [
          hoveredNode ? [hoveredNode] : null,
          'selected',
        ]);
      }

      setLastInteraction(null);
      setStartInteractionVector(null);
    },
    [configSpaceCursor, hoveredNode, canvasPoolManager, lastInteraction]
  );

  return (
    <Fragment>
      <Canvas
        ref={setSpansCanvasRef}
        onMouseMove={onCanvasMouseMove}
        onMouseLeave={onCanvasMouseLeave}
        onMouseUp={onCanvasMouseUp}
        onMouseDown={onCanvasMouseDown}
        cursor={lastInteraction === 'pan' ? 'grabbing' : 'default'}
      />
      {/* transaction loads after profile, so we want to show loading even if it's in initial state */}
      {profiledTransaction.type === 'loading' ||
      profiledTransaction.type === 'initial' ? (
        <LoadingIndicatorContainer>
          <LoadingIndicator size={42} />
        </LoadingIndicatorContainer>
      ) : profiledTransaction.type === 'errored' ? (
        <MessageContainer>{t('No associated transaction found')}</MessageContainer>
      ) : profiledTransaction.type === 'resolved' && spanChart.spans.length <= 1 ? (
        <MessageContainer>{t('Transaction has no spans')}</MessageContainer>
      ) : null}
      {hoveredNode && spansRenderer && configSpaceCursor && spansCanvas && spansView ? (
        <BoundTooltip
          bounds={canvasBounds}
          cursor={configSpaceCursor}
          canvas={spansCanvas}
          canvasView={spansView}
        >
          <FlamegraphTooltipFrameMainInfo>
            <FlamegraphTooltipColorIndicator
              backgroundColor={formatColorForSpan(hoveredNode, spansRenderer)}
            />
            {spanChart.formatter(hoveredNode.duration)}{' '}
            {formatWeightToTransactionDuration(hoveredNode, spanChart)}{' '}
            {hoveredNode.node.span.description}
          </FlamegraphTooltipFrameMainInfo>
          <FlamegraphTooltipTimelineInfo>
            {hoveredNode.node.span.op ? `${t('op')}:${hoveredNode.node.span.op} ` : null}
            {hoveredNode.node.span.status
              ? `${t('status')}:${hoveredNode.node.span.status}`
              : null}
          </FlamegraphTooltipTimelineInfo>
          <FlamegraphTooltipTimelineInfo>
            {spansRenderer.spanChart.timelineFormatter(hoveredNode.start)} {' \u2014 '}
            {spansRenderer.spanChart.timelineFormatter(hoveredNode.end)}
          </FlamegraphTooltipTimelineInfo>
        </BoundTooltip>
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
