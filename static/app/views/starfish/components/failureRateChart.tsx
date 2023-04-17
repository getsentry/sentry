import {useTheme} from '@emotion/react';
import max from 'lodash/max';
import min from 'lodash/min';

import {AreaChart, AreaChartProps} from 'sentry/components/charts/areaChart';
import ChartZoom from 'sentry/components/charts/chartZoom';
import {LineChart} from 'sentry/components/charts/lineChart';
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
  isLineChart?: boolean;
  log?: boolean;
  previousData?: Series[];
  stacked?: boolean;
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

function FailureRateChart({
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
  isLineChart,
  stacked,
}: Props) {
  const router = useRouter();
  const theme = useTheme();

  if (!data || data.length <= 0) {
    return null;
  }

  const colors = chartColors ?? theme.charts.getColorPalette(4);

  const durationOnly = false;
  const percentOnly = true;

  const dataMax = durationOnly
    ? computeAxisMax(data)
    : percentOnly
    ? computeMax(data)
    : undefined;

  const durationUnit = getDurationUnit(data);

  const yAxes = [
    {
      minInterval: durationUnit,
      splitNumber: definedAxisTicks,
      max: dataMax,
      type: 'value',
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
    },
  ];

  const areaChartProps = {
    seriesOptions: {
      showSymbol: false,
    },
    grid,
    yAxes,
    utc,
    isGroupedByDate: true,
    showTimeInTooltip: true,
    colors,
    tooltip: {
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
            <LineChart
              height={height}
              {...zoomRenderProps}
              series={series}
              previousPeriod={previousData}
              xAxis={xAxis}
              yAxis={areaChartProps.yAxes ? areaChartProps.yAxes[0] : []}
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
            stacked={stacked}
            {...areaChartProps}
          />
        );
      }}
    </ChartZoom>
  );
}

export default FailureRateChart;
