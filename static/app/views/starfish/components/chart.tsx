import {RefObject, useEffect, useRef, useState} from 'react';
import {useTheme} from '@emotion/react';
import {LineSeriesOption} from 'echarts';
import * as echarts from 'echarts/core';
import {
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
import {LineChart} from 'sentry/components/charts/lineChart';
import LineSeries from 'sentry/components/charts/series/lineSeries';
import ScatterSeries from 'sentry/components/charts/series/scatterSeries';
import {DateString} from 'sentry/types';
import {EChartClickHandler, ReactEchartsRef, Series} from 'sentry/types/echarts';
import {
  axisLabelFormatter,
  getDurationUnit,
  tooltipFormatter,
} from 'sentry/utils/discover/charts';
import {aggregateOutputType} from 'sentry/utils/discover/fields';
import {DAY, HOUR} from 'sentry/utils/formatters';
import usePageFilters from 'sentry/utils/usePageFilters';
import useRouter from 'sentry/utils/useRouter';
import {getDateFilters} from 'sentry/views/starfish/utils/dates';

const STARFISH_CHART_GROUP = 'starfish_chart_group';

type Props = {
  data: Series[];
  end: DateString;
  loading: boolean;
  start: DateString;
  statsPeriod: string | null | undefined;
  utc: boolean;
  aggregateOutputFormat?: 'number' | 'percentage' | 'duration';
  chartColors?: string[];
  chartGroup?: string;
  definedAxisTicks?: number;
  disableXAxis?: boolean;
  forwardedRef?: RefObject<ReactEchartsRef>;
  grid?: AreaChartProps['grid'];
  height?: number;
  hideYAxisSplitLine?: boolean;
  isBarChart?: boolean;
  isLineChart?: boolean;
  log?: boolean;
  onClick?: EChartClickHandler;
  previousData?: Series[];
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
function computeAxisMax(data: Series[], stacked?: boolean) {
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
  return Math.round(Math.ceil(maxValue / step) * step);
}

function Chart({
  data,
  previousData,
  statsPeriod,
  start,
  end,
  utc,
  loading,
  height,
  grid,
  disableXAxis,
  definedAxisTicks,
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
  forwardedRef,
  chartGroup,
  tooltipFormatterOptions = {},
}: Props) {
  const router = useRouter();
  const theme = useTheme();
  const pageFilter = usePageFilters();
  const {startTime, endTime} = getDateFilters(pageFilter);

  const defaultRef = useRef<ReactEchartsRef>(null);
  const chartRef = forwardedRef || defaultRef;

  const echartsInstance = chartRef?.current?.getEchartsInstance();
  if (echartsInstance && !echartsInstance.group) {
    echartsInstance.group = chartGroup ?? STARFISH_CHART_GROUP;
  }

  if (!data || data.length <= 0) {
    return null;
  }

  const colors = chartColors ?? theme.charts.getColorPalette(4);

  const durationOnly =
    aggregateOutputFormat === 'duration' ||
    data.every(value => aggregateOutputType(value.seriesName) === 'duration');
  const percentOnly =
    aggregateOutputFormat === 'percentage' ||
    data.every(value => aggregateOutputType(value.seriesName) === 'percentage');

  let dataMax = durationOnly
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

  const durationUnit = getDurationUnit(data);

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
      minInterval: durationUnit,
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
      minInterval: durationUnit,
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
            durationUnit
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
        utc,
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

  if (loading) {
    if (isLineChart) {
      return <LineChart height={height} series={[]} {...areaChartProps} />;
    }
    if (isBarChart) {
      return <BarChart height={height} series={[]} {...areaChartProps} />;
    }
    return <AreaChart height={height} series={[]} {...areaChartProps} />;
  }
  const series: Series[] = data.map((values, _) => ({
    ...values,
    yAxisIndex: 0,
    xAxisIndex: 0,
  }));

  const xAxisInterval = getXAxisInterval(startTime, endTime);

  const xAxis: XAXisOption = disableXAxis
    ? {
        show: false,
        axisLabel: {show: true, margin: 0},
        axisLine: {show: false},
      }
    : {
        type: 'time',
        maxInterval: xAxisInterval,
        axisLabel: {
          formatter: function (value: number) {
            if (endTime.diff(startTime, 'days') > 30) {
              return moment(value).format('MMMM DD');
            }
            if (startTime.isSame(endTime, 'day')) {
              return moment(value).format('HH:mm');
            }
            return moment(value).format('MMMM DD HH:mm');
          },
        },
      };

  return (
    <ChartZoom router={router} period={statsPeriod} start={start} end={end} utc={utc}>
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
              legend={showLegend ? {top: 0, right: 0} : undefined}
              onClick={onClick}
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
              ]}
            />
          );
        }

        if (isBarChart) {
          return (
            <BarChart
              height={height}
              series={series}
              xAxis={xAxis}
              additionalSeries={transformedThroughput}
              yAxes={areaChartProps.yAxes}
              tooltip={areaChartProps.tooltip}
              colors={colors}
              grid={grid}
              legend={showLegend ? {top: 0, right: 0} : undefined}
            />
          );
        }

        return (
          <AreaChart
            forwardedRef={chartRef}
            height={height}
            {...zoomRenderProps}
            series={series}
            previousPeriod={previousData}
            additionalSeries={transformedThroughput}
            xAxis={xAxis}
            stacked={stacked}
            {...areaChartProps}
          />
        );
      }}
    </ChartZoom>
  );
}

export default Chart;

export function useSynchronizeCharts(deps: boolean[] = []) {
  const [synchronized, setSynchronized] = useState<boolean>(false);
  useEffect(() => {
    if (deps.every(Boolean)) {
      echarts.connect(STARFISH_CHART_GROUP);
      setSynchronized(true);
    }
  }, [deps, synchronized]);
}

const getXAxisInterval = (startTime: moment.Moment, endTime: moment.Moment) => {
  const dateRange = endTime.diff(startTime);
  if (dateRange >= 30 * DAY) {
    return 7 * DAY;
  }
  if (dateRange >= 3 * DAY) {
    return DAY;
  }
  if (dateRange >= 1 * DAY) {
    return 12 * HOUR;
  }
  return HOUR;
};
