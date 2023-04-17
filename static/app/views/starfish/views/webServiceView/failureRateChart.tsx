import {useTheme} from '@emotion/react';
import {YAXisOption} from 'echarts/types/dist/shared';
import max from 'lodash/max';

import {AreaChartProps} from 'sentry/components/charts/areaChart';
import ChartZoom from 'sentry/components/charts/chartZoom';
import {LineChart} from 'sentry/components/charts/lineChart';
import CHART_PALETTE from 'sentry/constants/chartPalette';
import {DateString} from 'sentry/types';
import {Series} from 'sentry/types/echarts';
import {tooltipFormatter} from 'sentry/utils/discover/charts';
import {formatPercentage} from 'sentry/utils/formatters';
import useRouter from 'sentry/utils/useRouter';

type Props = {
  data: Series[];
  end: DateString;
  loading: boolean;
  start: DateString;
  statsPeriod: string | null | undefined;
  utc: boolean;
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
}: Props) {
  const router = useRouter();
  const theme = useTheme();

  if (!data || data.length <= 0) {
    return null;
  }

  const colors = [CHART_PALETTE[5][4]];
  const dataMax = computeMax(data);

  const yAxis: YAXisOption = {
    max: dataMax,
    type: 'value',
    axisLabel: {
      color: theme.chartLabel,
      formatter: (value: number) => formatPercentage(value, 1),
    },
  };

  const chartProps = {
    seriesOptions: {
      showSymbol: false,
    },
    grid,
    utc,
    isGroupedByDate: true,
    showTimeInTooltip: true,
    colors,
    tooltip: {
      valueFormatter: value => {
        return tooltipFormatter(value, 'percentage');
      },
    },
  } as Omit<AreaChartProps, 'series'>;

  if (loading) {
    return <LineChart height={height} series={[]} {...chartProps} />;
  }

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
          series={data}
          previousPeriod={previousData}
          xAxis={xAxis}
          yAxis={yAxis}
          tooltip={chartProps.tooltip}
        />
      )}
    </ChartZoom>
  );
}

export default FailureRateChart;
