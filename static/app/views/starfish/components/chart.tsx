import {useTheme} from '@emotion/react';
import {LineSeriesOption} from 'echarts';
import {YAXisOption} from 'echarts/types/dist/shared';
import max from 'lodash/max';
import min from 'lodash/min';

import {AreaChart, AreaChartProps} from 'sentry/components/charts/areaChart';
import {BarChart} from 'sentry/components/charts/barChart';
import BaseChart from 'sentry/components/charts/baseChart';
import ChartZoom from 'sentry/components/charts/chartZoom';
import {LineChart} from 'sentry/components/charts/lineChart';
import LineSeries from 'sentry/components/charts/series/lineSeries';
import ScatterSeries from 'sentry/components/charts/series/scatterSeries';
import {DateString} from 'sentry/types';
import {Series} from 'sentry/types/echarts';
import {
  axisLabelFormatter,
  getDurationUnit,
  tooltipFormatter,
} from 'sentry/utils/discover/charts';
import {aggregateOutputType} from 'sentry/utils/discover/fields';
import useRouter from 'sentry/utils/useRouter';

type Props = {
  data: Series[];
  end: DateString;
  loading: boolean;
  start: DateString;
  statsPeriod: string | null | undefined;
  utc: boolean;
  chartColors?: string[];
  definedAxisTicks?: number;
  disableXAxis?: boolean;
  grid?: AreaChartProps['grid'];
  height?: number;
  hideYAxisSplitLine?: boolean;
  isBarChart?: boolean;
  isLineChart?: boolean;
  log?: boolean;
  previousData?: Series[];
  scatterPlot?: Series[];
  showLegend?: boolean;
  stacked?: boolean;
  throughput?: {count: number; interval: string}[];
};

function computeMax(data: Series[]) {
  const valuesDict = data.map(value => value.data.map(point => point.value));

  return max(valuesDict.map(max)) as number;
}

// adapted from https://stackoverflow.com/questions/11397239/rounding-up-for-a-graph-maximum
function computeAxisMax(data: Series[]) {
  // assumes min is 0
  let maxValue = 0;
  if (data.length > 2) {
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
}: Props) {
  const router = useRouter();
  const theme = useTheme();

  if (!data || data.length <= 0) {
    return null;
  }

  const colors = chartColors ?? theme.charts.getColorPalette(4);

  const durationOnly = data.every(
    value => aggregateOutputType(value.seriesName) === 'duration'
  );
  const percentOnly = data.every(
    value => aggregateOutputType(value.seriesName) === 'percentage'
  );

  let dataMax = durationOnly
    ? computeAxisMax([...data, ...(scatterPlot?.[0]?.data?.length ? scatterPlot : [])])
    : percentOnly
    ? computeMax(data)
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
            aggregateOutputType(data[0].seriesName),
            undefined,
            durationUnit
          );
        },
      },
      splitLine: hideYAxisSplitLine ? {show: false} : undefined,
    },
    ...additionalAxis,
  ];

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
    colors,
    tooltip: {
      trigger: 'axis',
      axisPointer: {
        type: 'cross',
        label: {show: false},
      },
      valueFormatter: (value, seriesName) => {
        return tooltipFormatter(
          value,
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
  const series = data.map((values, _) => ({
    ...values,
    yAxisIndex: 0,
    xAxisIndex: 0,
  }));

  const xAxis = disableXAxis
    ? {
        show: false,
        axisLabel: {show: true, margin: 0},
        axisLine: {show: false},
      }
    : undefined;

  return (
    <ChartZoom router={router} period={statsPeriod} start={start} end={end} utc={utc}>
      {zoomRenderProps => {
        if (isLineChart) {
          return (
            <BaseChart
              {...zoomRenderProps}
              height={height}
              previousPeriod={previousData}
              additionalSeries={transformedThroughput}
              xAxis={xAxis}
              yAxes={areaChartProps.yAxes}
              tooltip={areaChartProps.tooltip}
              colors={colors}
              grid={grid}
              legend={showLegend ? {top: 0, right: 0} : undefined}
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
