import {forwardRef, useCallback, useEffect, useMemo, useRef} from 'react';
import styled from '@emotion/styled';
import * as Sentry from '@sentry/react';
import * as echarts from 'echarts/core';
import {CanvasRenderer} from 'echarts/renderers';

import {updateDateTime} from 'sentry/actionCreators/pageFilters';
import {transformToAreaSeries} from 'sentry/components/charts/areaChart';
import {transformToBarSeries} from 'sentry/components/charts/barChart';
import type {BaseChartProps} from 'sentry/components/charts/baseChart';
import BaseChart from 'sentry/components/charts/baseChart';
import {transformToLineSeries} from 'sentry/components/charts/lineChart';
import ScatterSeries from 'sentry/components/charts/series/scatterSeries';
import type {DateTimeObject} from 'sentry/components/charts/utils';
import type {ReactEchartsRef} from 'sentry/types/echarts';
import mergeRefs from 'sentry/utils/mergeRefs';
import {isCumulativeOp} from 'sentry/utils/metrics';
import {formatMetricsUsingUnitAndOp} from 'sentry/utils/metrics/formatters';
import type {MetricCorrelation} from 'sentry/utils/metrics/types';
import {MetricDisplayType} from 'sentry/utils/metrics/types';
import useRouter from 'sentry/utils/useRouter';
import {DDM_CHART_GROUP} from 'sentry/views/ddm/constants';
import type {FocusAreaProps} from 'sentry/views/ddm/context';
import {useFocusArea} from 'sentry/views/ddm/focusArea';

import {getFormatter} from '../../components/charts/components/tooltip';

import {useMetricSamples} from './useMetricSamples';
import type {Sample, ScatterSeries as ScatterSeriesType, Series} from './widget';

type ChartProps = {
  displayType: MetricDisplayType;
  series: Series[];
  widgetIndex: number;
  correlations?: MetricCorrelation[];
  focusArea?: FocusAreaProps;
  height?: number;
  highlightedSampleId?: string;
  onSampleClick?: (sample: Sample) => void;
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
      focusArea,
      height,
      correlations,
      onSampleClick,
      highlightedSampleId,
    },
    forwardedRef
  ) => {
    const router = useRouter();
    const chartRef = useRef<ReactEchartsRef>(null);

    const handleZoom = useCallback(
      (range: DateTimeObject) => {
        Sentry.metrics.increment('ddm.enhance.zoom');
        updateDateTime(range, router, {save: true});
      },
      [router]
    );

    const focusAreaBrush = useFocusArea({
      ...focusArea,
      chartRef,
      opts: {
        widgetIndex,
        isDisabled: !focusArea?.onAdd || !handleZoom,
        useFullYAxis: isCumulativeOp(operation),
      },
      onZoom: handleZoom,
    });

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
          .map(s => ({
            ...s,
            silent: true,
          })),
      [series]
    );

    const valueFormatter = useCallback(
      (value: number) => {
        return formatMetricsUsingUnitAndOp(value, unit, operation);
      },
      [unit, operation]
    );

    const samples = useMetricSamples({
      chartRef,
      correlations,
      onClick: onSampleClick,
      highlightedSampleId,
      operation,
      timeseries: series,
    });

    // TODO(ddm): This assumes that all series have the same bucket size
    const bucketSize = seriesToShow[0]?.data[1]?.name - seriesToShow[0]?.data[0]?.name;
    const isSubMinuteBucket = bucketSize < 60_000;
    const seriesLength = seriesToShow[0]?.data.length;
    const displayFogOfWar = isCumulativeOp(operation);

    const chartProps = useMemo(() => {
      const timeseriesFormatters = {
        valueFormatter,
        isGroupedByDate: true,
        bucketSize,
        showTimeInTooltip: true,
        addSecondsToTimeFormat: isSubMinuteBucket,
        limit: 10,
        filter: (_, seriesParam) => {
          return seriesParam?.axisId === 'xAxis';
        },
      };

      const heightOptions = height ? {height} : {autoHeightResize: true};

      return {
        ...heightOptions,
        ...focusAreaBrush.options,

        forwardedRef: mergeRefs([forwardedRef, chartRef]),
        series: seriesToShow,
        renderer: seriesToShow.length > 20 ? ('canvas' as const) : ('svg' as const),
        isGroupedByDate: true,
        colors: seriesToShow.map(s => s.color),
        grid: {top: 5, bottom: 0, left: 0, right: 0},
        onClick: samples.handleClick,
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
            const isThisChartHovered = hoveredEchartElement === chartRef?.current?.ele;
            if (!isThisChartHovered) {
              return '';
            }
            if (params.seriesType === 'scatter') {
              return getFormatter(samples.formatters)(params, asyncTicket);
            }
            return getFormatter(timeseriesFormatters)(params, asyncTicket);
          },
        },
        yAxes: [
          {
            // used to find and convert datapoint to pixel position
            id: 'yAxis',
            axisLabel: {
              formatter: (value: number) => {
                return valueFormatter(value);
              },
            },
          },
          samples.yAxis,
        ],
        xAxes: [
          {
            // used to find and convert datapoint to pixel position
            id: 'xAxis',
            axisPointer: {
              snap: true,
            },
          },
          samples.xAxis,
        ],
      };
    }, [
      bucketSize,
      focusAreaBrush.options,
      focusAreaBrush.isDrawingRef,
      forwardedRef,
      isSubMinuteBucket,
      seriesToShow,
      height,
      samples.handleClick,
      samples.xAxis,
      samples.yAxis,
      samples.formatters,
      valueFormatter,
    ]);

    return (
      <ChartWrapper>
        {focusAreaBrush.overlay}
        <CombinedChart
          {...chartProps}
          displayType={displayType}
          scatterSeries={samples.series}
        />
        {displayFogOfWar && (
          <FogOfWar bucketSize={bucketSize} seriesLength={seriesLength} />
        )}
      </ChartWrapper>
    );
  }
);

interface CombinedChartProps extends BaseChartProps {
  displayType: MetricDisplayType;
  series: Series[];
  scatterSeries?: ScatterSeriesType[];
}

function CombinedChart({
  displayType,
  series,
  scatterSeries = [],
  ...chartProps
}: CombinedChartProps) {
  const combinedSeries = useMemo(() => {
    if (displayType === MetricDisplayType.LINE) {
      return [
        ...transformToLineSeries({series}),
        ...transformToScatterSeries({series: scatterSeries, displayType}),
      ];
    }

    if (displayType === MetricDisplayType.BAR) {
      return [
        ...transformToBarSeries({series, stacked: true, animation: false}),
        ...transformToScatterSeries({series: scatterSeries, displayType}),
      ];
    }

    if (displayType === MetricDisplayType.AREA) {
      return [
        ...transformToAreaSeries({series, stacked: true, colors: chartProps.colors}),
        ...transformToScatterSeries({series: scatterSeries, displayType}),
      ];
    }

    return [];
  }, [displayType, scatterSeries, series, chartProps.colors]);

  return <BaseChart {...chartProps} series={combinedSeries} />;
}

function transformToScatterSeries({
  series,
  displayType,
}: {
  displayType: MetricDisplayType;
  series: Series[];
}) {
  return series.map(({seriesName, data: seriesData, ...options}) => {
    if (displayType === MetricDisplayType.BAR) {
      return ScatterSeries({
        ...options,
        name: seriesName,
        data: seriesData?.map(({value, name}) => ({value: [name, value]})),
      });
    }

    return ScatterSeries({
      ...options,
      name: seriesName,
      data: seriesData?.map(({value, name}) => [name, value]),
      animation: false,
    });
  });
}

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
  height: 100%;
`;

const FogOfWarOverlay = styled('div')<{width?: number}>`
  height: calc(100% - 29px);
  width: ${p => p.width}%;
  position: absolute;
  right: 0px;
  top: 5px;
  pointer-events: none;
  background: linear-gradient(
    90deg,
    ${p => p.theme.background}00 0%,
    ${p => p.theme.background}FF 70%,
    ${p => p.theme.background}FF 100%
  );
`;
