import {Fragment, useCallback, useEffect, useMemo, useRef, useState} from 'react';
import styled from '@emotion/styled';
import {mat3, vec2} from 'gl-matrix';

import {BoundTooltip} from 'sentry/components/profiling/boundTooltip';
import {t} from 'sentry/locale';
import {CanvasPoolManager, CanvasScheduler} from 'sentry/utils/profiling/canvasScheduler';
import {CanvasView} from 'sentry/utils/profiling/canvasView';
import {useDispatchFlamegraphState} from 'sentry/utils/profiling/flamegraph/hooks/useFlamegraphState';
import {useFlamegraphTheme} from 'sentry/utils/profiling/flamegraph/useFlamegraphTheme';
import {FlamegraphCanvas} from 'sentry/utils/profiling/flamegraphCanvas';
import {formatColorForSpan, Rect} from 'sentry/utils/profiling/gl/utils';
import {SelectedFrameRenderer} from 'sentry/utils/profiling/renderers/selectedFrameRenderer';
import {SpanChartRenderer2D} from 'sentry/utils/profiling/renderers/spansRenderer';
import {SpanChart, SpanChartNode} from 'sentry/utils/profiling/spanChart';
import usePrevious from 'sentry/utils/usePrevious';

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
  const dispatch = useDispatchFlamegraphState();
  const flamegraphTheme = useFlamegraphTheme();
  const scheduler = useMemo(() => new CanvasScheduler(), []);

  const [configSpaceCursor, setConfigSpaceCursor] = useState<vec2 | null>(null);
  const [startPanVector, setStartPanVector] = useState<vec2 | null>(null);
  const [lastInteraction, setLastInteraction] = useState<
    'pan' | 'click' | 'zoom' | 'scroll' | 'select' | 'resize' | null
  >(null);

  const previousInteraction = usePrevious(lastInteraction);
  const beforeInteractionConfigView = useRef<Rect | null>(null);
  const selectedFramesRef = useRef<SpanChartNode[] | null>(null);

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
    if (!spansView) {
      return;
    }

    // Check if we are starting a new interaction
    if (previousInteraction === null && lastInteraction) {
      beforeInteractionConfigView.current = spansView.configView.clone();
      return;
    }

    if (
      beforeInteractionConfigView.current &&
      !beforeInteractionConfigView.current.equals(spansView.configView)
    ) {
      dispatch({
        type: 'checkpoint',
        payload: spansView.configView.clone(),
      });
    }
  }, [lastInteraction, spansView, dispatch, previousInteraction]);

  useEffect(() => {
    canvasPoolManager.registerScheduler(scheduler);
    return () => canvasPoolManager.unregisterScheduler(scheduler);
  }, [canvasPoolManager, scheduler]);

  useEffect(() => {
    if (!spansCanvas || !spansView || !spansRenderer) {
      return undefined;
    }

    const drawSpans = () => {
      spansRenderer.draw(spansView.fromConfigView(spansCanvas.physicalSpace));
    };

    drawSpans();

    scheduler.registerBeforeFrameCallback(drawSpans);

    return () => {
      scheduler.unregisterBeforeFrameCallback(drawSpans);
    };
  }, [spansCanvas, spansRenderer, scheduler, spansView]);

  useEffect(() => {
    if (!spansCanvasRef || !spansView || !spansCanvas || !selectedSpanRenderer) {
      return undefined;
    }

    const drawHoveredSpanBorder = () => {
      if (hoveredNode) {
        selectedSpanRenderer.draw(
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
          spansView.fromTransformedConfigView(spansCanvas.physicalSpace)
        );
      }
    };

    scheduler.registerAfterFrameCallback(drawHoveredSpanBorder);
    scheduler.draw();

    return () => {
      scheduler.unregisterAfterFrameCallback(drawHoveredSpanBorder);
    };
  }, [
    spansCanvas,
    spansView,
    selectedSpanRenderer,
    scheduler,
    spansCanvasRef,
    flamegraphTheme,
    hoveredNode,
  ]);

  const onMouseDrag = useCallback(
    (evt: React.MouseEvent<HTMLCanvasElement>) => {
      if (!spansCanvas || !spansView || !startPanVector) {
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
        spansView.fromConfigView(spansCanvas.physicalSpace)
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
    [spansCanvas, spansView, startPanVector, canvasPoolManager]
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

      if (startPanVector) {
        onMouseDrag(evt);
        setLastInteraction('pan');
      } else {
        setLastInteraction(null);
      }
    },
    [spansCanvas, spansView, onMouseDrag, startPanVector]
  );

  const onMinimapCanvasMouseUp = useCallback(() => {
    setConfigSpaceCursor(null);
    setLastInteraction(null);
  }, []);

  const onMinimapZoom = useCallback(
    (evt: WheelEvent) => {
      if (!spansCanvas || !spansView) {
        return;
      }

      const identity = mat3.identity(mat3.create());
      const scale = 1 - evt.deltaY * 0.001 * -1; // -1 to invert scale

      const mouseInConfigSpace = spansView.getTransformedConfigViewCursor(
        vec2.fromValues(evt.offsetX, evt.offsetY),
        spansCanvas
      );

      const configCenter = vec2.fromValues(mouseInConfigSpace[0], spansView.configView.y);

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
    [spansCanvas, spansView, canvasPoolManager]
  );

  const onMinimapScroll = useCallback(
    (evt: WheelEvent) => {
      if (!spansCanvas || !spansView) {
        return;
      }

      {
        const physicalDelta = vec2.fromValues(evt.deltaX * 0.8, evt.deltaY);
        const physicalToConfig = mat3.invert(
          mat3.create(),
          spansView.fromConfigView(spansCanvas.physicalSpace)
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
      }
    },
    [spansCanvas, spansView, canvasPoolManager]
  );

  useEffect(() => {
    if (!spansCanvas || !spansView || !selectedSpanRenderer) {
      return undefined;
    }

    const onNodeHighlight = (
      node: SpanChartNode[] | null,
      mode: 'hover' | 'selected'
    ) => {
      if (mode === 'selected') {
        selectedFramesRef.current = node;
      }
      scheduler.draw();
    };

    const drawSelectedFrameBorder = () => {
      if (selectedFramesRef.current) {
        selectedSpanRenderer.draw(
          selectedFramesRef.current.map(frame => {
            return new Rect(frame.start, frame.depth, frame.end - frame.start, 1);
          }),
          {
            BORDER_COLOR: flamegraphTheme.COLORS.SELECTED_FRAME_BORDER_COLOR,
            BORDER_WIDTH: flamegraphTheme.SIZES.FRAME_BORDER_WIDTH,
          },
          spansView.fromTransformedConfigView(spansCanvas.physicalSpace)
        );
      }
    };

    scheduler.on('highlight span', onNodeHighlight);
    scheduler.registerAfterFrameCallback(drawSelectedFrameBorder);
    scheduler.draw();

    return () => {
      scheduler.off('highlight span', onNodeHighlight);
      scheduler.unregisterAfterFrameCallback(drawSelectedFrameBorder);
    };
  }, [spansCanvas, spansView, selectedSpanRenderer, scheduler, flamegraphTheme]);

  useEffect(() => {
    if (!spansCanvasRef) {
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
      // rendered on the flamegraph are removed from the view
      setConfigSpaceCursor(null);

      if (evt.metaKey || evt.ctrlKey) {
        onMinimapZoom(evt);
        setLastInteraction('zoom');
      } else {
        onMinimapScroll(evt);
        setLastInteraction('scroll');
      }
    }

    spansCanvasRef.addEventListener('wheel', onCanvasWheel);

    return () => {
      window.clearTimeout(wheelStopTimeoutId);
      spansCanvasRef.removeEventListener('wheel', onCanvasWheel);
    };
  }, [spansCanvasRef, onMinimapZoom, onMinimapScroll]);

  useEffect(() => {
    window.addEventListener('mouseup', onMinimapCanvasMouseUp);

    return () => {
      window.removeEventListener('mouseup', onMinimapCanvasMouseUp);
    };
  }, [onMinimapCanvasMouseUp]);

  const onCanvasMouseLeave = useCallback(() => {
    setConfigSpaceCursor(null);
    setStartPanVector(null);
    setLastInteraction(null);
  }, []);

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
          selectedFramesRef.current?.length === 1 &&
          selectedFramesRef.current[0] === hoveredNode
        ) {
          selectedFramesRef.current = [hoveredNode];
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
      setStartPanVector(null);
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
      />
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

const Canvas = styled('canvas')`
  width: 100%;
  height: 100%;
  position: absolute;
  left: 0;
  top: 0;
  user-select: none;
`;
