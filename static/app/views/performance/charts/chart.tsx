import {useTheme} from '@emotion/react';
import max from 'lodash/max';
import min from 'lodash/min';

import type {AreaChartProps} from 'sentry/components/charts/areaChart';
import {AreaChart} from 'sentry/components/charts/areaChart';
import ChartZoom from 'sentry/components/charts/chartZoom';
import {LineChart} from 'sentry/components/charts/lineChart';
import type {DateString} from 'sentry/types/core';
import type {Series} from 'sentry/types/echarts';
import {
  axisLabelFormatter,
  getDurationUnit,
  tooltipFormatter,
} from 'sentry/utils/discover/charts';
import {aggregateOutputType} from 'sentry/utils/discover/fields';

type Props = {
  data: Series[];
  end: DateString;
  loading: boolean;
  start: DateString;
  statsPeriod: string | null | undefined;
  utc: boolean;
  chartColors?: string[];
  definedAxisTicks?: number;
  disableMultiAxis?: boolean;
  disableXAxis?: boolean;
  grid?: AreaChartProps['grid'];
  height?: number;
  isLineChart?: boolean;
  previousData?: Series[];
};

// adapted from https://stackoverflow.com/questions/11397239/rounding-up-for-a-graph-maximum
export function computeAxisMax(data: Series[]) {
  // assumes min is 0
  const valuesDict = data.map(value => value.data.map(point => point.value));
  const maxValue = max(valuesDict.map(max)) as number;

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
  disableMultiAxis,
  disableXAxis,
  definedAxisTicks,
  chartColors,
  isLineChart,
}: Props) {
  const theme = useTheme();

  if (!data || data.length <= 0) {
    return null;
  }

  const colors = chartColors ?? theme.charts.getColorPalette(4)!;

  const durationOnly = data.every(
    value => aggregateOutputType(value.seriesName) === 'duration'
  );

  const dataMax = durationOnly ? computeAxisMax(data) : undefined;

  const xAxes = disableMultiAxis
    ? undefined
    : [
        {
          gridIndex: 0,
          type: 'time' as const,
        },
        {
          gridIndex: 1,
          type: 'time' as const,
        },
      ];

  const durationUnit = getDurationUnit(data);

  const yAxes = disableMultiAxis
    ? [
        {
          minInterval: durationUnit,
          splitNumber: definedAxisTicks,
          axisLabel: {
            color: theme.chartLabel,
            formatter(value: number) {
              return axisLabelFormatter(
                value,
                aggregateOutputType(data[0]!.seriesName),
                undefined,
                durationUnit
              );
            },
          },
        },
      ]
    : [
        {
          gridIndex: 0,
          scale: true,
          minInterval: durationUnit,
          max: dataMax,
          axisLabel: {
            color: theme.chartLabel,
            formatter(value: number) {
              return axisLabelFormatter(
                value,
                aggregateOutputType(data[0]!.seriesName),
                undefined,
                durationUnit
              );
            },
          },
        },
        {
          gridIndex: 1,
          scale: true,
          max: dataMax,
          minInterval: durationUnit,
          axisLabel: {
            color: theme.chartLabel,
            formatter(value: number) {
              return axisLabelFormatter(
                value,
                aggregateOutputType(data[1]!.seriesName),
                undefined,
                durationUnit
              );
            },
          },
        },
      ];

  const axisPointer = disableMultiAxis
    ? undefined
    : {
        // Link the two series x-axis together.
        link: [{xAxisIndex: [0, 1]}],
      };

  const areaChartProps = {
    seriesOptions: {
      showSymbol: false,
    },
    grid: disableMultiAxis
      ? grid
      : [
          {
            top: '8px',
            left: '24px',
            right: '52%',
            bottom: '16px',
          },
          {
            top: '8px',
            left: '52%',
            right: '24px',
            bottom: '16px',
          },
        ],
    axisPointer,
    xAxes,
    yAxes,
    utc,
    isGroupedByDate: true,
    showTimeInTooltip: true,
    colors: [colors[0]!, colors[1]!],
    tooltip: {
      valueFormatter: (value, seriesName) => {
        return tooltipFormatter(
          value,
          aggregateOutputType(data?.length ? data[0]!.seriesName : seriesName)
        );
      },
      nameFormatter(value: string) {
        return value === 'epm()' ? 'tpm()' : value;
      },
    },
  };

  if (loading) {
    if (isLineChart) {
      return <LineChart height={height} series={[]} {...areaChartProps} />;
    }
    return <AreaChart height={height} series={[]} {...areaChartProps} />;
  }
  const series = data.map((values, i: number) => ({
    ...values,
    yAxisIndex: i,
    xAxisIndex: i,
  }));

  const xAxis = disableXAxis
    ? {
        show: false,
        axisLabel: {show: true, margin: 0},
        axisLine: {show: false},
      }
    : undefined;

  return (
    <ChartZoom
      period={statsPeriod}
      start={start}
      end={end}
      utc={utc}
      xAxisIndex={disableMultiAxis ? undefined : [0, 1]}
    >
      {zoomRenderProps => {
        if (isLineChart) {
          return (
            <LineChart
              height={height}
              {...zoomRenderProps}
              series={series}
              previousPeriod={previousData}
              xAxis={xAxis}
              yAxis={areaChartProps.yAxes[0]}
              tooltip={areaChartProps.tooltip}
            />
          );
        }

        return (
          <AreaChart
            height={height}
            {...zoomRenderProps}
            series={series}
            previousPeriod={previousData}
            xAxis={xAxis}
            {...areaChartProps}
          />
        );
      }}
    </ChartZoom>
  );
}

export default Chart;
