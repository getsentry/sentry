import {forwardRef, useCallback, useEffect, useMemo, useRef} from 'react';
import styled from '@emotion/styled';
import {useHover} from '@react-aria/interactions';
import * as Sentry from '@sentry/react';
import * as echarts from 'echarts/core';
import {CanvasRenderer} from 'echarts/renderers';

import {updateDateTime} from 'sentry/actionCreators/pageFilters';
import {AreaChart} from 'sentry/components/charts/areaChart';
import {BarChart} from 'sentry/components/charts/barChart';
import {LineChart} from 'sentry/components/charts/lineChart';
import {DateTimeObject} from 'sentry/components/charts/utils';
import {ReactEchartsRef} from 'sentry/types/echarts';
import mergeRefs from 'sentry/utils/mergeRefs';
import {formatMetricsUsingUnitAndOp, MetricDisplayType} from 'sentry/utils/metrics';
import useRouter from 'sentry/utils/useRouter';
import {FocusArea, useFocusAreaBrush} from 'sentry/views/ddm/chartBrush';
import {DDM_CHART_GROUP} from 'sentry/views/ddm/constants';

import {getFormatter} from '../../components/charts/components/tooltip';

import {Series} from './widget';

type ChartProps = {
  addFocusArea: (area: FocusArea) => void;
  displayType: MetricDisplayType;
  focusArea: FocusArea | null;
  removeFocusArea: () => void;
  series: Series[];
  widgetIndex: number;
  operation?: string;
};

// We need to enable canvas renderer for echarts before we use it here.
// Once we use it in more places, this should probably move to a more global place
// But for now we keep it here to not invluence the bundle size of the main chunks.
echarts.use(CanvasRenderer);

export const MetricChart = forwardRef<ReactEchartsRef, ChartProps>(
  (
    {
      series,
      displayType,
      operation,
      widgetIndex,
      addFocusArea,
      focusArea,
      removeFocusArea,
    },
    forwardedRef
  ) => {
    const router = useRouter();
    const chartRef = useRef<ReactEchartsRef>(null);

    const {hoverProps, isHovered} = useHover({
      isDisabled: false,
    });

    const handleZoom = useCallback(
      (range: DateTimeObject) => {
        Sentry.metrics.increment('ddm.enhance.zoom');
        updateDateTime(range, router, {save: true});
      },
      [router]
    );

    const focusAreaBrush = useFocusAreaBrush(
      chartRef,
      focusArea,
      addFocusArea,
      removeFocusArea,
      handleZoom,
      {
        widgetIndex,
        isDisabled: !isHovered,
      }
    );

    // TODO(ddm): Try to do this in a more elegant way
    useEffect(() => {
      const echartsInstance = chartRef?.current?.getEchartsInstance();
      if (echartsInstance && !echartsInstance.group) {
        echartsInstance.group = DDM_CHART_GROUP;
      }
    });

    const unit = series[0]?.unit;
    const seriesToShow = useMemo(
      () =>
        series
          .filter(s => !s.hidden)
          .map(s => ({...s, silent: displayType === MetricDisplayType.BAR})),
      [series, displayType]
    );

    // TODO(ddm): This assumes that all series have the same bucket size
    const bucketSize = seriesToShow[0]?.data[1]?.name - seriesToShow[0]?.data[0]?.name;
    const isSubMinuteBucket = bucketSize < 60_000;
    const seriesLength = seriesToShow[0]?.data.length;
    const displayFogOfWar = operation && ['sum', 'count'].includes(operation);

    const chartProps = useMemo(() => {
      const formatters = {
        valueFormatter: (value: number) =>
          formatMetricsUsingUnitAndOp(value, unit, operation),
        isGroupedByDate: true,
        bucketSize,
        showTimeInTooltip: true,
        addSecondsToTimeFormat: isSubMinuteBucket,
        limit: 10,
      };
      return {
        ...focusAreaBrush.options,
        forwardedRef: mergeRefs([forwardedRef, chartRef]),
        series: seriesToShow,
        renderer: seriesToShow.length > 20 ? ('canvas' as const) : ('svg' as const),
        isGroupedByDate: true,
        height: 300,
        colors: seriesToShow.map(s => s.color),
        grid: {top: 20, bottom: 20, left: 15, right: 25},
        tooltip: {
          formatter: (params, asyncTicket) => {
            if (focusAreaBrush.isDrawingRef.current) {
              return '';
            }
            const hoveredEchartElement = Array.from(
              document.querySelectorAll(':hover')
            ).find(element => {
              return element.classList.contains('echarts-for-react');
            });

            if (hoveredEchartElement === chartRef?.current?.ele) {
              return getFormatter(formatters)(params, asyncTicket);
            }
            return '';
          },
        },
        yAxis: {
          axisLabel: {
            formatter: (value: number) => {
              return formatMetricsUsingUnitAndOp(value, unit, operation);
            },
          },
        },
        xAxis: {
          axisPointer: {
            snap: true,
          },
        },
      };
    }, [
      bucketSize,
      focusAreaBrush.options,
      focusAreaBrush.isDrawingRef,
      forwardedRef,
      isSubMinuteBucket,
      operation,
      seriesToShow,
      unit,
    ]);

    return (
      <ChartWrapper {...hoverProps} onMouseDownCapture={focusAreaBrush.startBrush}>
        {focusAreaBrush.overlay}
        {displayType === MetricDisplayType.LINE ? (
          <LineChart {...chartProps} />
        ) : displayType === MetricDisplayType.AREA ? (
          <AreaChart {...chartProps} />
        ) : (
          <BarChart stacked animation={false} {...chartProps} />
        )}
        {displayFogOfWar && (
          <FogOfWar bucketSize={bucketSize} seriesLength={seriesLength} />
        )}
      </ChartWrapper>
    );
  }
);

function FogOfWar({
  bucketSize,
  seriesLength,
}: {
  bucketSize?: number;
  seriesLength?: number;
}) {
  if (!bucketSize || !seriesLength) {
    return null;
  }

  const widthFactor = getWidthFactor(bucketSize);
  const fogOfWarWidth = widthFactor * bucketSize + 30_000;

  const seriesWidth = bucketSize * seriesLength;

  // If either of these are undefiend, NaN or 0 the result will be invalid
  if (!fogOfWarWidth || !seriesWidth) {
    return null;
  }

  const width = (fogOfWarWidth / seriesWidth) * 100;

  return <FogOfWarOverlay width={width ?? 0} />;
}

function getWidthFactor(bucketSize: number) {
  // In general, fog of war should cover the last bucket
  if (bucketSize > 30 * 60_000) {
    return 1;
  }

  // for 10s timeframe we want to show a fog of war that spans last 10 buckets
  // because on average, we are missing last 90 seconds of data
  if (bucketSize <= 10_000) {
    return 10;
  }

  // For smaller time frames we want to show a wider fog of war
  return 2;
}

const ChartWrapper = styled('div')`
  position: relative;
  height: 300px;
`;

const FogOfWarOverlay = styled('div')<{width?: number}>`
  height: 244px;
  width: ${p => p.width}%;
  position: absolute;
  right: 21px;
  top: 18px;
  pointer-events: none;
  background: linear-gradient(
    90deg,
    ${p => p.theme.background}00 0%,
    ${p => p.theme.background}FF 70%,
    ${p => p.theme.background}FF 100%
  );
`;
