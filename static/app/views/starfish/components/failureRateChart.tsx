import {useTheme} from '@emotion/react';
import max from 'lodash/max';

import {AreaChartProps} from 'sentry/components/charts/areaChart';
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
  previousData?: Series[];
};

function computeMax(data: Series[]) {
  const valuesDict = data.map(value => value.data.map(point => point.value));

  return max(valuesDict.map(max)) as number;
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
}: Props) {
  const router = useRouter();
  const theme = useTheme();

  if (!data || data.length <= 0) {
    return null;
  }

  const colors = chartColors ?? theme.charts.getColorPalette(4);
  const dataMax = computeMax(data);
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

  const chartProps = {
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
    return <LineChart height={height} series={[]} {...chartProps} />;
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
      {zoomRenderProps => (
        <LineChart
          height={height}
          {...zoomRenderProps}
          series={series}
          previousPeriod={previousData}
          xAxis={xAxis}
          yAxis={chartProps.yAxes ? chartProps.yAxes[0] : []}
          tooltip={chartProps.tooltip}
        />
      )}
    </ChartZoom>
  );
}

export default FailureRateChart;
