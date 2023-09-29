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
import {mat3, vec2} from 'gl-matrix';

import {t} from 'sentry/locale';
import {
  CanvasPoolManager,
  useCanvasScheduler,
} from 'sentry/utils/profiling/canvasScheduler';
import {CanvasView} from 'sentry/utils/profiling/canvasView';
import {useFlamegraphTheme} from 'sentry/utils/profiling/flamegraph/useFlamegraphTheme';
import {FlamegraphCanvas} from 'sentry/utils/profiling/flamegraphCanvas';
import {FlamegraphChart as FlamegraphChartModel} from 'sentry/utils/profiling/flamegraphChart';
import {
  getConfigViewTranslationBetweenVectors,
  getPhysicalSpacePositionFromOffset,
  transformMatrixBetweenRect,
} from 'sentry/utils/profiling/gl/utils';
import {FlamegraphChartRenderer} from 'sentry/utils/profiling/renderers/chartRenderer';
import {Rect} from 'sentry/utils/profiling/speedscope';
import {useProfiles} from 'sentry/views/profiling/profilesProvider';

import {useCanvasScroll} from './interactions/useCanvasScroll';
import {useCanvasZoomOrScroll} from './interactions/useCanvasZoomOrScroll';
import {useInteractionViewCheckPoint} from './interactions/useInteractionViewCheckPoint';
import {useWheelCenterZoom} from './interactions/useWheelCenterZoom';
import {
  CollapsibleTimelineLoadingIndicator,
  CollapsibleTimelineMessage,
} from './collapsibleTimeline';
import {FlamegraphChartTooltip} from './flamegraphChartTooltip';

interface FlamegraphChartProps {
  canvasBounds: Rect;
  canvasPoolManager: CanvasPoolManager;
  chart: FlamegraphChartModel | null;
  chartCanvas: FlamegraphCanvas | null;
  chartCanvasRef: HTMLCanvasElement | null;
  chartView: CanvasView<FlamegraphChartModel> | null;
  noMeasurementMessage: string | undefined;
  setChartCanvasRef: (ref: HTMLCanvasElement | null) => void;
}

export function FlamegraphChart({
  chart,
  canvasPoolManager,
  chartView,
  chartCanvas,
  chartCanvasRef,
  setChartCanvasRef,
  canvasBounds,
  noMeasurementMessage,
}: FlamegraphChartProps) {
  const profiles = useProfiles();
  const scheduler = useCanvasScheduler(canvasPoolManager);
  const theme = useFlamegraphTheme();

  const [configSpaceCursor, setConfigSpaceCursor] = useState<vec2 | null>(null);
  const [startInteractionVector, setStartInteractionVector] = useState<vec2 | null>(null);
  const [lastInteraction, setLastInteraction] = useState<
    'pan' | 'click' | 'zoom' | 'scroll' | 'select' | 'resize' | null
  >(null);

  const configSpaceCursorRef = useRef<vec2 | null>(null);
  configSpaceCursorRef.current = configSpaceCursor;

  const chartRenderer = useMemo(() => {
    if (!chartCanvasRef || !chart) {
      return null;
    }

    return new FlamegraphChartRenderer(chartCanvasRef, chart, theme);
  }, [chartCanvasRef, chart, theme]);

  const drawchart = useCallback(() => {
    if (!chartCanvas || !chart || !chartView || !chartRenderer) {
      return;
    }

    const configViewToPhysicalSpaceTransform = transformMatrixBetweenRect(
      chartView.configView,
      chartCanvas.physicalSpace
    );

    const offsetPhysicalSpace = chartCanvas.physicalSpace
      // shrink the chart height by the padding to pad the top of chart
      .withHeight(chartCanvas.physicalSpace.height - theme.SIZES.CHART_PX_PADDING);

    const physicalSpaceToOffsetPhysicalSpaceTransform = transformMatrixBetweenRect(
      chartCanvas.physicalSpace,
      offsetPhysicalSpace
    );

    const configToPhysicalSpace = mat3.create();
    mat3.multiply(
      configToPhysicalSpace,
      physicalSpaceToOffsetPhysicalSpaceTransform,
      configViewToPhysicalSpaceTransform
    );

    mat3.multiply(
      configToPhysicalSpace,
      transformMatrixBetweenRect(chartView.configView, chartCanvas.physicalSpace),
      chartView.configSpaceTransform
    );

    mat3.multiply(
      configToPhysicalSpace,
      chartCanvas.physicalSpace.invertYTransform(),
      configToPhysicalSpace
    );

    chartRenderer.draw(
      chartView.toOriginConfigView(chartView.configView),
      configToPhysicalSpace, // this
      chartView.fromTransformedConfigView(chartCanvas.logicalSpace),
      configSpaceCursorRef
    );
  }, [chart, chartCanvas, chartRenderer, chartView, theme]);

  useEffect(() => {
    drawchart();
  }, [drawchart, configSpaceCursor]);

  useEffect(() => {
    scheduler.registerBeforeFrameCallback(drawchart);
    scheduler.draw();

    return () => {
      scheduler.unregisterBeforeFrameCallback(drawchart);
    };
  }, [drawchart, scheduler]);

  const onMouseDrag = useCallback(
    (evt: React.MouseEvent<HTMLCanvasElement>) => {
      if (!chartCanvas || !chartView || !startInteractionVector) {
        return;
      }

      const configDelta = getConfigViewTranslationBetweenVectors(
        evt.nativeEvent.offsetX,
        evt.nativeEvent.offsetY,
        startInteractionVector,
        chartView,
        chartCanvas
      );

      if (!configDelta) {
        return;
      }

      canvasPoolManager.dispatch('transform config view', [configDelta, chartView]);
      setStartInteractionVector(
        getPhysicalSpacePositionFromOffset(
          evt.nativeEvent.offsetX,
          evt.nativeEvent.offsetY
        )
      );
    },
    [chartCanvas, chartView, startInteractionVector, canvasPoolManager]
  );

  const onCanvasMouseMove = useCallback(
    (evt: React.MouseEvent<HTMLCanvasElement>) => {
      if (!chartCanvas || !chartView) {
        return;
      }

      const configSpaceMouse = chartView.getTransformedConfigViewCursor(
        vec2.fromValues(evt.nativeEvent.offsetX, evt.nativeEvent.offsetY),
        chartCanvas
      );

      setConfigSpaceCursor(configSpaceMouse);

      if (startInteractionVector) {
        onMouseDrag(evt);
        setLastInteraction('pan');
      } else {
        setLastInteraction(null);
      }
    },
    [chartCanvas, chartView, onMouseDrag, startInteractionVector]
  );

  const onMapCanvasMouseUp = useCallback(() => {
    setConfigSpaceCursor(null);
    setLastInteraction(null);
  }, []);

  useEffect(() => {
    window.addEventListener('mouseup', onMapCanvasMouseUp);

    return () => {
      window.removeEventListener('mouseup', onMapCanvasMouseUp);
    };
  }, [onMapCanvasMouseUp]);

  const onWheelCenterZoom = useWheelCenterZoom(chartCanvas, chartView, canvasPoolManager);
  const onCanvasScroll = useCanvasScroll(chartCanvas, chartView, canvasPoolManager);

  useCanvasZoomOrScroll({
    setConfigSpaceCursor,
    setLastInteraction,
    handleWheel: onWheelCenterZoom,
    handleScroll: onCanvasScroll,
    canvas: chartCanvasRef,
  });

  useInteractionViewCheckPoint({
    view: chartView,
    lastInteraction,
  });

  // When a user click anywhere outside the spans, clear cursor and selected node
  useEffect(() => {
    const onClickOutside = (evt: MouseEvent) => {
      if (!chartCanvasRef || chartCanvasRef.contains(evt.target as Node)) {
        return;
      }
      setConfigSpaceCursor(null);
    };

    document.addEventListener('click', onClickOutside);

    return () => {
      document.removeEventListener('click', onClickOutside);
    };
  });

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

      if (!chartView) {
        return;
      }

      if (!configSpaceCursor) {
        setLastInteraction(null);
        setStartInteractionVector(null);
        return;
      }

      setLastInteraction(null);
      setStartInteractionVector(null);
    },
    [configSpaceCursor, chartView]
  );

  return (
    <Fragment>
      <Canvas
        ref={setChartCanvasRef}
        onMouseMove={onCanvasMouseMove}
        onMouseLeave={onCanvasMouseLeave}
        onMouseUp={onCanvasMouseUp}
        onMouseDown={onCanvasMouseDown}
        cursor={lastInteraction === 'pan' ? 'grabbing' : 'default'}
      />
      {configSpaceCursor && chartRenderer && chartCanvas && chartView && chart ? (
        <FlamegraphChartTooltip
          chart={chart}
          configSpaceCursor={configSpaceCursor}
          chartCanvas={chartCanvas}
          chartView={chartView}
          chartRenderer={chartRenderer}
          canvasBounds={canvasBounds}
        />
      ) : null}
      {/* transaction loads after profile, so we want to show loading even if it's in initial state */}
      {profiles.type === 'loading' || profiles.type === 'initial' ? (
        <CollapsibleTimelineLoadingIndicator />
      ) : profiles.type === 'resolved' && !chart?.series.length ? (
        <CollapsibleTimelineMessage>
          {noMeasurementMessage || t('Profile has no measurements')}
        </CollapsibleTimelineMessage>
      ) : (chart?.series?.length ?? 0) > 0 &&
        chart?.series.every(
          s => s.points.length < FlamegraphChartModel.MIN_RENDERABLE_POINTS
        ) ? (
        <CollapsibleTimelineMessage>
          {noMeasurementMessage || t('Profile has no measurements')}
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
