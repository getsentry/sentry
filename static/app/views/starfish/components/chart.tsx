import {RefObject, useEffect, useRef, useState} from 'react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';
import {LineSeriesOption} from 'echarts';
import * as echarts from 'echarts/core';
import {
  MarkLineOption,
  TooltipFormatterCallback,
  TopLevelFormatterParams,
  XAXisOption,
  YAXisOption,
} from 'echarts/types/dist/shared';
import max from 'lodash/max';
import min from 'lodash/min';
import moment from 'moment';

import {AreaChart, AreaChartProps} from 'sentry/components/charts/areaChart';
import {BarChart} from 'sentry/components/charts/barChart';
import BaseChart from 'sentry/components/charts/baseChart';
import ChartZoom from 'sentry/components/charts/chartZoom';
import {
  FormatterOptions,
  getFormatter,
} from 'sentry/components/charts/components/tooltip';
import ErrorPanel from 'sentry/components/charts/errorPanel';
import LineSeries from 'sentry/components/charts/series/lineSeries';
import ScatterSeries from 'sentry/components/charts/series/scatterSeries';
import TransitionChart from 'sentry/components/charts/transitionChart';
import TransparentLoadingMask from 'sentry/components/charts/transparentLoadingMask';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {IconWarning} from 'sentry/icons';
import {
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
import {
  aggregateOutputType,
  AggregationOutputType,
  RateUnits,
} from 'sentry/utils/discover/fields';
import usePageFilters from 'sentry/utils/usePageFilters';
import useRouter from 'sentry/utils/useRouter';
import {SpanMetricsField} from 'sentry/views/starfish/types';

const STARFISH_CHART_GROUP = 'starfish_chart_group';

export const STARFISH_FIELDS: Record<string, {outputType: AggregationOutputType}> = {
  [SpanMetricsField.SPAN_DURATION]: {
    outputType: 'duration',
  },
  [SpanMetricsField.SPAN_SELF_TIME]: {
    outputType: 'duration',
  },
  [SpanMetricsField.HTTP_RESPONSE_TRANSFER_SIZE]: {
    outputType: 'size',
  },
  [SpanMetricsField.HTTP_DECODED_RESPONSE_CONTENT_LENGTH]: {
    outputType: 'size',
  },
  [SpanMetricsField.HTTP_RESPONSE_CONTENT_LENGTH]: {
    outputType: 'size',
  },
};

type Props = {
  data: Series[];
  loading: boolean;
  aggregateOutputFormat?: AggregationOutputType;
  chartColors?: string[];
  chartGroup?: string;
  dataMax?: number;
  definedAxisTicks?: number;
  disableXAxis?: boolean;
  durationUnit?: number;
  errored?: boolean;
  forwardedRef?: RefObject<ReactEchartsRef>;
  grid?: AreaChartProps['grid'];
  height?: number;
  hideYAxis?: boolean;
  hideYAxisSplitLine?: boolean;
  isBarChart?: boolean;
  isLineChart?: boolean;
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
  preserveIncompletePoints?: boolean;
  previousData?: Series[];
  rateUnit?: RateUnits;
  scatterPlot?: Series[];
  showLegend?: boolean;
  stacked?: boolean;
  throughput?: {count: number; interval: string}[];
  tooltipFormatterOptions?: FormatterOptions;
};

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

function Chart({
  data,
  dataMax,
  previousData,
  loading,
  height,
  grid,
  disableXAxis,
  definedAxisTicks,
  durationUnit,
  rateUnit,
  chartColors,
  isBarChart,
  isLineChart,
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
  errored,
  onLegendSelectChanged,
  onDataZoom,
  legendFormatter,
  preserveIncompletePoints,
}: Props) {
  const router = useRouter();
  const theme = useTheme();
  const pageFilters = usePageFilters();
  const {start, end, period, utc} = pageFilters.selection.datetime;

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
            undefined,
            durationUnit ?? getDurationUnit(data),
            rateUnit
          );
        },
      },
      splitLine: hideYAxisSplitLine ? {show: false} : undefined,
    },
    ...additionalAxis,
  ];

  const formatter: TooltipFormatterCallback<TopLevelFormatterParams> = (
    params,
    asyncTicket
  ) => {
    // Kinda jank. Get hovered dom elements and check if any of them are the chart
    const hoveredEchartElement = Array.from(document.querySelectorAll(':hover')).find(
      element => {
        return element.classList.contains('echarts-for-react');
      }
    );

    if (hoveredEchartElement === chartRef?.current?.ele) {
      // Return undefined to use default formatter
      return getFormatter({
        isGroupedByDate: true,
        showTimeInTooltip: true,
        utc: utc ?? false,
        valueFormatter: (value, seriesName) => {
          return tooltipFormatter(
            value,
            aggregateOutputFormat ?? aggregateOutputType(seriesName)
          );
        },
        ...tooltipFormatterOptions,
      })(params, asyncTicket);
    }
    // Return empty string, ie no tooltip
    return '';
  };

  const areaChartProps = {
    seriesOptions: {
      showSymbol: false,
    },
    grid,
    yAxes,
    utc,
    legend: showLegend
      ? {
          top: 0,
          right: 10,
          ...(legendFormatter ? {formatter: legendFormatter} : {}),
        }
      : undefined,
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
            aggregateOutputType(data && data.length ? data[0].seriesName : seriesName)
        );
      },
      nameFormatter(value: string) {
        return value === 'epm()' ? 'tpm()' : value;
      },
    },
  } as Omit<AreaChartProps, 'series'>;

  const series: Series[] = data.map((values, _) => ({
    ...values,
    yAxisIndex: 0,
    xAxisIndex: 0,
  }));

  // Trims off the last data point because it's incomplete
  const trimmedSeries =
    !preserveIncompletePoints && period && !start && !end
      ? series.map(serie => {
          return {
            ...serie,
            data: serie.data.slice(0, -1),
          };
        })
      : series;

  const xAxis: XAXisOption = disableXAxis
    ? {
        show: false,
        axisLabel: {show: true, margin: 0},
        axisLine: {show: false},
      }
    : {
        min: moment(trimmedSeries[0]?.data[0]?.name).unix() * 1000,
        max:
          moment(trimmedSeries[0]?.data[trimmedSeries[0].data.length - 1]?.name).unix() *
          1000,
      };

  function getChart() {
    if (errored) {
      return (
        <ErrorPanel>
          <IconWarning color="gray300" size="lg" />
        </ErrorPanel>
      );
    }

    return (
      <ChartZoom
        router={router}
        saveOnZoom
        period={period}
        start={start}
        end={end}
        utc={utc}
        onDataZoom={onDataZoom}
      >
        {zoomRenderProps => {
          if (isLineChart) {
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
                  showLegend ? {top: 0, right: 10, formatter: legendFormatter} : undefined
                }
                onClick={onClick}
                onMouseOut={onMouseOut}
                onMouseOver={onMouseOver}
                onHighlight={onHighlight}
                series={[
                  ...trimmedSeries.map(({seriesName, data: seriesData, ...options}) =>
                    LineSeries({
                      ...options,
                      name: seriesName,
                      data: seriesData?.map(({value, name}) => [name, value]),
                      animation: false,
                      animationThreshold: 1,
                      animationDuration: 0,
                    })
                  ),
                  ...(scatterPlot ?? []).map(
                    ({seriesName, data: seriesData, ...options}) =>
                      ScatterSeries({
                        ...options,
                        name: seriesName,
                        data: seriesData?.map(({value, name}) => [name, value]),
                        animation: false,
                      })
                  ),
                ]}
              />
            );
          }

          if (isBarChart) {
            return (
              <BarChart
                height={height}
                series={trimmedSeries}
                xAxis={xAxis}
                additionalSeries={transformedThroughput}
                yAxes={areaChartProps.yAxes}
                tooltip={areaChartProps.tooltip}
                colors={colors}
                grid={grid}
                legend={showLegend ? {top: 0, right: 10} : undefined}
                onClick={onClick}
              />
            );
          }

          return (
            <AreaChart
              forwardedRef={chartRef}
              height={height}
              {...zoomRenderProps}
              series={trimmedSeries}
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
        }}
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

export function useSynchronizeCharts(deps: boolean[] = []) {
  const [synchronized, setSynchronized] = useState<boolean>(false);
  useEffect(() => {
    if (deps.every(Boolean)) {
      echarts?.connect?.(STARFISH_CHART_GROUP);
      setSynchronized(true);
    }
  }, [deps, synchronized]);
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
