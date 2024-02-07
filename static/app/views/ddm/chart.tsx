import {forwardRef, useCallback, useEffect, useMemo, useRef} from 'react';
import styled from '@emotion/styled';
import * as Sentry from '@sentry/react';
import Color from 'color';
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
import {MetricDisplayType} from 'sentry/utils/metrics/types';
import useRouter from 'sentry/utils/useRouter';
import type {FocusAreaProps} from 'sentry/views/ddm/context';
import {useFocusArea} from 'sentry/views/ddm/focusArea';

import {getFormatter} from '../../components/charts/components/tooltip';
import {isChartHovered} from '../../components/charts/utils';

import {useChartSamples} from './useChartSamples';
import type {SamplesProps, ScatterSeries as ScatterSeriesType, Series} from './widget';

type ChartProps = {
  displayType: MetricDisplayType;
  series: Series[];
  widgetIndex: number;
  focusArea?: FocusAreaProps;
  group?: string;
  height?: number;
  operation?: string;
  scatter?: SamplesProps;
};

// We need to enable canvas renderer for echarts before we use it here.
// Once we use it in more places, this should probably move to a more global place
// But for now we keep it here to not invluence the bundle size of the main chunks.
echarts.use(CanvasRenderer);

export const MetricChart = forwardRef<ReactEchartsRef, ChartProps>(
  (
    {series, displayType, operation, widgetIndex, focusArea, height, scatter, group},
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
      if (!group) {
        return;
      }
      const echartsInstance = chartRef?.current?.getEchartsInstance();
      if (echartsInstance && !echartsInstance.group) {
        echartsInstance.group = group;
      }
    });

    // TODO(ddm): This assumes that all series have the same bucket size
    const bucketSize = series[0]?.data[1]?.name - series[0]?.data[0]?.name;
    const isSubMinuteBucket = bucketSize < 60_000;

    const unit = series[0]?.unit;
    const fogOfWarBuckets = getWidthFactor(bucketSize);

    const seriesToShow = useMemo(
      () =>
        series
          .filter(s => !s.hidden)
          // Split series in two parts, one for the main chart and one for the fog of war
          // The order is important as the tooltip will show the first series first (for overlaps)
          .flatMap(s => [
            {
              ...s,
              silent: true,
              data: s.data.slice(0, -fogOfWarBuckets),
            },
            displayType === MetricDisplayType.BAR
              ? createFogOfWarBarSeries(s, fogOfWarBuckets)
              : displayType === MetricDisplayType.LINE
                ? createFogOfWarLineSeries(s, fogOfWarBuckets)
                : createFogOfWarAreaSeries(s, fogOfWarBuckets),
          ]),
      [series, fogOfWarBuckets, displayType]
    );

    const valueFormatter = useCallback(
      (value: number) => {
        return formatMetricsUsingUnitAndOp(value, unit, operation);
      },
      [unit, operation]
    );

    const samples = useChartSamples({
      chartRef,
      correlations: scatter?.data,
      onClick: scatter?.onClick,
      highlightedSampleId: scatter?.higlightedId,
      operation,
      timeseries: series,
      valueFormatter,
    });

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
        devicePixelRatio: 2,
        renderer: 'canvas' as const,
        isGroupedByDate: true,
        colors: seriesToShow.map(s => s.color),
        grid: {top: 5, bottom: 0, left: 0, right: 0},
        onClick: samples.handleClick,
        tooltip: {
          formatter: (params, asyncTicket) => {
            if (focusAreaBrush.isDrawingRef.current) {
              return '';
            }
            if (!isChartHovered(chartRef?.current)) {
              return '';
            }

            // Hovering a single correlated sample datapoint
            if (params.seriesType === 'scatter') {
              return getFormatter(samples.formatters)(params, asyncTicket);
            }

            // The mechanism by which we add the fog of war series to the chart, duplicates the series in the chart data
            // so we need to deduplicate the series before showing the tooltip
            // this assumes that the first series is the main series and the second is the fog of war series
            if (Array.isArray(params)) {
              const uniqueSeries = new Set<string>();
              const deDupedParams = params.filter(param => {
                if (uniqueSeries.has(param.seriesName)) {
                  return false;
                }
                uniqueSeries.add(param.seriesName);
                return true;
              });
              return getFormatter(timeseriesFormatters)(deDupedParams, asyncTicket);
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

const EXTRAPOLATED_AREA_STRIPE_IMG =
  'image://data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAoAAABkCAYAAAC/zKGXAAAAMUlEQVR4Ae3KoREAIAwEsMKgrMeYj8BzyIpEZyTZda16mPVJFEVRFEVRFEVRFMWO8QB4uATKpuU51gAAAABJRU5ErkJggg==';

const createFogOfWarBarSeries = (series: Series, fogBucketCnt = 0) => ({
  ...series,
  silent: true,
  data: series.data.map((data, index) => ({
    ...data,
    // W need to set a value for the non-fog of war buckets so that the stacking still works in echarts
    value: index < series.data.length - fogBucketCnt ? 0 : data.value,
  })),
  itemStyle: {
    opacity: 1,
    decal: {
      symbol: EXTRAPOLATED_AREA_STRIPE_IMG,
      dashArrayX: [6, 0],
      dashArrayY: [6, 0],
      rotation: Math.PI / 4,
    },
  },
});

const createFogOfWarLineSeries = (series: Series, fogBucketCnt = 0) => ({
  ...series,
  silent: true,
  // We include the last non-fog of war bucket so that the line is connected
  data: series.data.slice(-fogBucketCnt - 1),
  lineStyle: {
    type: 'dotted',
  },
});

const createFogOfWarAreaSeries = (series: Series, fogBucketCnt = 0) => ({
  ...series,
  silent: true,
  stack: 'fogOfWar',
  // We include the last non-fog of war bucket so that the line is connected
  data: series.data.slice(-fogBucketCnt - 1),
  lineStyle: {
    type: 'dotted',
    color: Color(series.color).lighten(0.3).string(),
  },
});

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
