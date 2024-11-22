import type {RefObject} from 'react';
import {createContext, useContext, useEffect, useMemo, useReducer, useRef} from 'react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';
import type {LineSeriesOption} from 'echarts';
import * as echarts from 'echarts/core';
import type {
  MarkLineOption,
  TooltipFormatterCallback,
  TopLevelFormatterParams,
  XAXisOption,
  YAXisOption,
} from 'echarts/types/dist/shared';
import max from 'lodash/max';
import min from 'lodash/min';

import type {AreaChartProps} from 'sentry/components/charts/areaChart';
import {AreaChart} from 'sentry/components/charts/areaChart';
import {BarChart} from 'sentry/components/charts/barChart';
import BaseChart from 'sentry/components/charts/baseChart';
import ChartZoom, {type ZoomRenderProps} from 'sentry/components/charts/chartZoom';
import type {FormatterOptions} from 'sentry/components/charts/components/tooltip';
import {getFormatter} from 'sentry/components/charts/components/tooltip';
import ErrorPanel from 'sentry/components/charts/errorPanel';
import ReleaseSeries from 'sentry/components/charts/releaseSeries';
import LineSeries from 'sentry/components/charts/series/lineSeries';
import ScatterSeries from 'sentry/components/charts/series/scatterSeries';
import TransitionChart from 'sentry/components/charts/transitionChart';
import TransparentLoadingMask from 'sentry/components/charts/transparentLoadingMask';
import {isChartHovered} from 'sentry/components/charts/utils';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {
  createIngestionSeries,
  getIngestionDelayBucketCount,
} from 'sentry/components/metrics/chart/chart';
import type {Series as MetricSeries} from 'sentry/components/metrics/chart/types';
import {IconWarning} from 'sentry/icons';
import type {
  EChartClickHandler,
  EChartDataZoomHandler,
  EChartEventHandler,
  EChartHighlightHandler,
  EChartMouseOutHandler,
  EChartMouseOverHandler,
  ReactEchartsRef,
  Series,
} from 'sentry/types/echarts';
import {
  axisLabelFormatter,
  getDurationUnit,
  tooltipFormatter,
} from 'sentry/utils/discover/charts';
import type {AggregationOutputType, RateUnit} from 'sentry/utils/discover/fields';
import {aggregateOutputType} from 'sentry/utils/discover/fields';
import {MetricDisplayType} from 'sentry/utils/metrics/types';
import usePageFilters from 'sentry/utils/usePageFilters';

const STARFISH_CHART_GROUP = 'starfish_chart_group';

export enum ChartType {
  BAR = 0,
  LINE = 1,
  AREA = 2,
}

export interface ChartRenderingProps {
  height: number;
  isFullscreen: boolean;
}

export const ChartRenderingContext = createContext<ChartRenderingProps | null>(null);

type Props = {
  data: Series[];
  loading: boolean;
  type: ChartType;
  aggregateOutputFormat?: AggregationOutputType;
  chartColors?: string[];
  chartGroup?: string;
  dataMax?: number;
  definedAxisTicks?: number;
  disableXAxis?: boolean;
  durationUnit?: number;
  error?: Error | null;
  forwardedRef?: RefObject<ReactEchartsRef>;
  grid?: AreaChartProps['grid'];
  height?: number;
  hideYAxis?: boolean;
  hideYAxisSplitLine?: boolean;
  legendFormatter?: (name: string) => string;
  log?: boolean;
  markLine?: MarkLineOption;
  onClick?: EChartClickHandler;
  onDataZoom?: EChartDataZoomHandler;
  onHighlight?: EChartHighlightHandler;
  onLegendSelectChanged?: EChartEventHandler<{
    name: string;
    selected: Record<string, boolean>;
    type: 'legendselectchanged';
  }>;
  onMouseOut?: EChartMouseOutHandler;
  onMouseOver?: EChartMouseOverHandler;
  previousData?: Series[];
  rateUnit?: RateUnit;
  scatterPlot?: Series[];
  showLegend?: boolean;
  stacked?: boolean;
  throughput?: {count: number; interval: string}[];
  tooltipFormatterOptions?: FormatterOptions;
};

function Chart({
  data,
  dataMax,
  previousData,
  loading,
  height: chartHeight,
  grid,
  disableXAxis,
  definedAxisTicks,
  durationUnit,
  rateUnit,
  chartColors,
  type,
  stacked,
  log,
  hideYAxisSplitLine,
  showLegend,
  scatterPlot,
  throughput,
  aggregateOutputFormat,
  onClick,
  onMouseOver,
  onMouseOut,
  onHighlight,
  forwardedRef,
  chartGroup,
  tooltipFormatterOptions = {},
  error,
  onLegendSelectChanged,
  onDataZoom,
  /**
   * Setting a default formatter for some reason causes `>` to
   * render correctly instead of rendering as `&gt;` in the legend.
   */
  legendFormatter = name => name,
}: Props) {
  const theme = useTheme();
  const pageFilters = usePageFilters();
  const {start, end, period, utc} = pageFilters.selection.datetime;
  const {projects, environments} = pageFilters.selection;

  const renderingContext = useContext(ChartRenderingContext);

  const height = renderingContext?.height ?? chartHeight;
  const isLegendVisible = renderingContext?.isFullscreen ?? showLegend;

  const defaultRef = useRef<ReactEchartsRef>(null);
  const chartRef = forwardedRef || defaultRef;

  const echartsInstance = chartRef?.current?.getEchartsInstance?.();
  if (echartsInstance && !echartsInstance.group) {
    echartsInstance.group = chartGroup ?? STARFISH_CHART_GROUP;
  }

  const colors = chartColors ?? theme.charts.getColorPalette(4);

  const durationOnly =
    aggregateOutputFormat === 'duration' ||
    data.every(value => aggregateOutputType(value.seriesName) === 'duration');
  const percentOnly =
    aggregateOutputFormat === 'percentage' ||
    data.every(value => aggregateOutputType(value.seriesName) === 'percentage');

  if (!dataMax) {
    dataMax = durationOnly
      ? computeAxisMax(
          [...data, ...(scatterPlot?.[0]?.data?.length ? scatterPlot : [])],
          stacked
        )
      : percentOnly
        ? computeMax([...data, ...(scatterPlot?.[0]?.data?.length ? scatterPlot : [])])
        : undefined;
    // Fix an issue where max == 1 for duration charts would look funky cause we round
    if (dataMax === 1 && durationOnly) {
      dataMax += 1;
    }
  }

  let transformedThroughput: LineSeriesOption[] | undefined = undefined;
  const additionalAxis: YAXisOption[] = [];

  if (throughput && throughput.length > 1) {
    transformedThroughput = [
      LineSeries({
        name: 'Throughput',
        data: throughput.map(({interval, count}) => [interval, count]),
        yAxisIndex: 1,
        lineStyle: {type: 'dashed', width: 1, opacity: 0.5},
        animation: false,
        animationThreshold: 1,
        animationDuration: 0,
      }),
    ];
    additionalAxis.push({
      minInterval: durationUnit ?? getDurationUnit(data),
      splitNumber: definedAxisTicks,
      max: dataMax,
      type: 'value',
      axisLabel: {
        color: theme.chartLabel,
        formatter(value: number) {
          return axisLabelFormatter(value, 'number', true);
        },
      },
      splitLine: hideYAxisSplitLine ? {show: false} : undefined,
    });
  }

  let series: Series[] = data.map((values, index) => ({
    ...values,
    yAxisIndex: 0,
    xAxisIndex: 0,
    id: values.seriesName,
    color: colors[index],
  }));
  let incompleteSeries: Series[] = [];

  const bucketSize =
    new Date(series[0]?.data[1]?.name).getTime() -
    new Date(series[0]?.data[0]?.name).getTime();
  const lastBucketTimestamp = new Date(
    series[0]?.data?.[series[0]?.data?.length - 1]?.name
  ).getTime();
  const ingestionBuckets = useMemo(() => {
    if (isNaN(bucketSize) || isNaN(lastBucketTimestamp)) {
      return 1;
    }
    return getIngestionDelayBucketCount(bucketSize, lastBucketTimestamp);
  }, [bucketSize, lastBucketTimestamp]);

  // TODO: Support bar charts
  if (type === ChartType.LINE || type === ChartType.AREA) {
    const metricChartType =
      type === ChartType.AREA ? MetricDisplayType.AREA : MetricDisplayType.LINE;
    const seriesToShow = series.map(serie => {
      const ingestionSeries = createIngestionSeries(
        serie as MetricSeries,
        ingestionBuckets,
        metricChartType
      );
      // this helper causes all the incomplete series to stack, here we remove the stacking
      if (!stacked) {
        for (const s of ingestionSeries) {
          delete s.stack;
        }
      }
      return ingestionSeries;
    });
    [series, incompleteSeries] = seriesToShow.reduce(
      (acc, serie, index) => {
        const [trimmed, incomplete] = acc;
        const {markLine: _, ...incompleteSerie} = serie[1] ?? {};

        return [
          [...trimmed, {...serie[0], color: colors[index]}],
          [
            ...incomplete,
            ...(Object.keys(incompleteSerie).length > 0 ? [incompleteSerie] : []),
          ],
        ];
      },
      [[], []] as [MetricSeries[], MetricSeries[]]
    );
  }

  const yAxes = [
    {
      minInterval: durationUnit ?? getDurationUnit(data),
      splitNumber: definedAxisTicks,
      max: dataMax,
      type: log ? 'log' : 'value',
      axisLabel: {
        color: theme.chartLabel,
        formatter(value: number) {
          return axisLabelFormatter(
            value,
            aggregateOutputFormat ?? aggregateOutputType(data[0].seriesName),
            true,
            durationUnit ?? getDurationUnit(data),
            rateUnit
          );
        },
      },
      splitLine: hideYAxisSplitLine ? {show: false} : undefined,
    },
    ...additionalAxis,
  ];

  const xAxis: XAXisOption = disableXAxis
    ? {
        show: false,
        axisLabel: {show: true, margin: 0},
        axisLine: {show: false},
      }
    : {};

  const formatter: TooltipFormatterCallback<TopLevelFormatterParams> = (
    params,
    asyncTicket
  ) => {
    // Only show the tooltip if the current chart is hovered
    // as chart groups trigger the tooltip for all charts in the group when one is hoverered
    if (!isChartHovered(chartRef?.current)) {
      return '';
    }
    let deDupedParams = params;
    if (Array.isArray(params)) {
      const uniqueSeries = new Set<string>();
      deDupedParams = params.filter(param => {
        // Filter null values from tooltip
        if (param.value[1] === null) {
          return false;
        }

        if (uniqueSeries.has(param.seriesName)) {
          return false;
        }
        uniqueSeries.add(param.seriesName);
        return true;
      });
    }
    // Return undefined to use default formatter
    return getFormatter({
      isGroupedByDate: true,
      showTimeInTooltip: true,
      truncate: true,
      utc: utc ?? false,
      valueFormatter: (value, seriesName) => {
        return tooltipFormatter(
          value,
          aggregateOutputFormat ?? aggregateOutputType(seriesName)
        );
      },
      ...tooltipFormatterOptions,
    })(deDupedParams, asyncTicket);
  };

  const areaChartProps = {
    seriesOptions: {
      showSymbol: false,
    },
    grid,
    yAxes,
    utc,
    legend: isLegendVisible ? {top: 0, right: 10, formatter: legendFormatter} : undefined,
    isGroupedByDate: true,
    showTimeInTooltip: true,
    tooltip: {
      formatter,
      trigger: 'axis',
      axisPointer: {
        type: 'cross',
        label: {show: false},
      },
      valueFormatter: (value, seriesName) => {
        return tooltipFormatter(
          value,
          aggregateOutputFormat ??
            aggregateOutputType(data?.length ? data[0].seriesName : seriesName)
        );
      },
      nameFormatter(value: string) {
        return value === 'epm()' ? 'tpm()' : value;
      },
    },
  } as Omit<AreaChartProps, 'series'>;

  function getChartWithSeries(
    zoomRenderProps: ZoomRenderProps,
    releaseSeries?: Series[]
  ) {
    if (error) {
      return (
        <ErrorPanel height={`${height}px`} data-test-id="chart-error-panel">
          <IconWarning color="gray300" size="lg" />
        </ErrorPanel>
      );
    }

    if (type === ChartType.LINE) {
      return (
        <BaseChart
          {...zoomRenderProps}
          ref={chartRef}
          height={height}
          previousPeriod={previousData}
          additionalSeries={transformedThroughput}
          xAxis={xAxis}
          yAxes={areaChartProps.yAxes}
          tooltip={areaChartProps.tooltip}
          colors={colors}
          grid={grid}
          legend={
            isLegendVisible ? {top: 0, right: 10, formatter: legendFormatter} : undefined
          }
          onClick={onClick}
          onMouseOut={onMouseOut}
          onMouseOver={onMouseOver}
          onHighlight={onHighlight}
          series={[
            ...series.map(({seriesName, data: seriesData, ...options}) =>
              LineSeries({
                ...options,
                name: seriesName,
                data: seriesData?.map(({value, name}) => [name, value]),
                animation: false,
                animationThreshold: 1,
                animationDuration: 0,
              })
            ),
            ...(scatterPlot ?? []).map(({seriesName, data: seriesData, ...options}) =>
              ScatterSeries({
                ...options,
                name: seriesName,
                data: seriesData?.map(({value, name}) => [name, value]),
                animation: false,
              })
            ),
            ...incompleteSeries.map(({seriesName, data: seriesData, ...options}) =>
              LineSeries({
                ...options,
                name: seriesName,
                data: seriesData?.map(({value, name}) => [name, value]),
                animation: false,
                animationThreshold: 1,
                animationDuration: 0,
              })
            ),
            ...(releaseSeries ?? []).map(({seriesName, data: seriesData, ...options}) =>
              LineSeries({
                ...options,
                name: seriesName,
                data: seriesData?.map(({value, name}) => [name, value]),
                animation: false,
                animationThreshold: 1,
                animationDuration: 0,
              })
            ),
          ]}
        />
      );
    }

    if (type === ChartType.BAR) {
      return (
        <BarChart
          {...zoomRenderProps}
          height={height}
          series={series}
          xAxis={xAxis}
          yAxis={{
            minInterval: durationUnit ?? getDurationUnit(data),
            splitNumber: definedAxisTicks,
            max: dataMax,
            axisLabel: {
              color: theme.chartLabel,
              formatter(value: number) {
                return axisLabelFormatter(
                  value,
                  aggregateOutputFormat ?? aggregateOutputType(data[0].seriesName),
                  true,
                  durationUnit ?? getDurationUnit(data),
                  rateUnit
                );
              },
            },
          }}
          tooltip={{
            valueFormatter: (value, seriesName) => {
              return tooltipFormatter(
                value,
                aggregateOutputFormat ??
                  aggregateOutputType(data?.length ? data[0].seriesName : seriesName)
              );
            },
          }}
          colors={colors}
          grid={grid}
          legend={
            isLegendVisible ? {top: 0, right: 10, formatter: legendFormatter} : undefined
          }
          onClick={onClick}
        />
      );
    }

    return (
      <AreaChart
        forwardedRef={chartRef}
        height={height}
        {...zoomRenderProps}
        series={[...series, ...incompleteSeries, ...(releaseSeries ?? [])]}
        previousPeriod={previousData}
        additionalSeries={transformedThroughput}
        xAxis={xAxis}
        stacked={stacked}
        colors={colors}
        onClick={onClick}
        {...areaChartProps}
        onLegendSelectChanged={onLegendSelectChanged}
      />
    );
  }

  function getChart() {
    if (error) {
      return (
        <ErrorPanel height={`${height}px`} data-test-id="chart-error-panel">
          <IconWarning color="gray300" size="lg" />
        </ErrorPanel>
      );
    }

    // add top-padding to the chart in full screen so that the legend
    // and graph do not overlap
    if (renderingContext?.isFullscreen) {
      grid = {...grid, top: '20px'};
    }

    // overlay additional series data such as releases and issues on top of the original insights chart
    return (
      <ChartZoom
        saveOnZoom
        period={period}
        start={start}
        end={end}
        utc={utc}
        onDataZoom={onDataZoom}
      >
        {zoomRenderProps =>
          renderingContext?.isFullscreen ? (
            <ReleaseSeries
              start={start}
              end={end}
              queryExtra={undefined}
              period={period}
              utc={utc}
              projects={projects}
              environments={environments}
            >
              {({releaseSeries}) => {
                return getChartWithSeries(zoomRenderProps, releaseSeries);
              }}
            </ReleaseSeries>
          ) : (
            getChartWithSeries(zoomRenderProps)
          )
        }
      </ChartZoom>
    );
  }

  return (
    <TransitionChart
      loading={loading}
      reloading={loading}
      height={height ? `${height}px` : undefined}
    >
      <LoadingScreen loading={loading} />
      {getChart()}
    </TransitionChart>
  );
}

export default Chart;

function computeMax(data: Series[]) {
  const valuesDict = data.map(value => value.data.map(point => point.value));

  return max(valuesDict.map(max)) as number;
}

// adapted from https://stackoverflow.com/questions/11397239/rounding-up-for-a-graph-maximum
export function computeAxisMax(data: Series[], stacked?: boolean) {
  // assumes min is 0
  let maxValue = 0;
  if (data.length > 1 && stacked) {
    for (let i = 0; i < data.length; i++) {
      maxValue += max(data[i].data.map(point => point.value)) as number;
    }
  } else {
    maxValue = computeMax(data);
  }

  if (maxValue <= 1) {
    return 1;
  }

  const power = Math.log10(maxValue);
  const magnitude = min([max([10 ** (power - Math.floor(power)), 0]), 10]) as number;

  let scale: number;
  if (magnitude <= 2.5) {
    scale = 0.2;
  } else if (magnitude <= 5) {
    scale = 0.5;
  } else if (magnitude <= 7.5) {
    scale = 1.0;
  } else {
    scale = 2.0;
  }

  const step = 10 ** Math.floor(power) * scale;
  return Math.ceil(Math.ceil(maxValue / step) * step);
}

export function useSynchronizeCharts(
  charts: number,
  ready: boolean,
  group: string = STARFISH_CHART_GROUP
) {
  // Tries to connect all the charts under the same group so the cursor is shared.
  const [, forceUpdate] = useReducer(x => x + 1, 0);

  useEffect(() => {
    if (charts && ready) {
      echarts?.connect?.(group);

      // need to force a re-render otherwise only the currently visible charts
      // in the group will end up connected
      forceUpdate();
    }
  }, [
    charts, // this re-connects when new charts are added/removed
    ready, // this waits until the chart data has loaded before attempting to connect
    group,
  ]);
}

const StyledTransparentLoadingMask = styled(props => (
  <TransparentLoadingMask {...props} maskBackgroundColor="transparent" />
))`
  display: flex;
  justify-content: center;
  align-items: center;
`;

export function LoadingScreen({loading}: {loading: boolean}) {
  if (!loading) {
    return null;
  }
  return (
    <StyledTransparentLoadingMask visible={loading}>
      <LoadingIndicator mini />
    </StyledTransparentLoadingMask>
  );
}
