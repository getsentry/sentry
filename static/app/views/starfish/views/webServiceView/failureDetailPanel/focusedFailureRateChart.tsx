import {useTheme} from '@emotion/react';
import {YAXisOption} from 'echarts/types/dist/shared';

import {AreaChartProps} from 'sentry/components/charts/areaChart';
import MarkArea from 'sentry/components/charts/components/markArea';
import {LineChart} from 'sentry/components/charts/lineChart';
import {t} from 'sentry/locale';
import {Series} from 'sentry/types/echarts';
import {tooltipFormatter} from 'sentry/utils/discover/charts';
import {formatAbbreviatedNumber} from 'sentry/utils/formatters';
import ChartPanel from 'sentry/views/starfish/components/chartPanel';
import {FailureSpike} from 'sentry/views/starfish/views/webServiceView/types';

type Props = {
  data: Series[];
  spike: FailureSpike;
};

function FocusedFailureRateChart({data, spike}: Props) {
  const theme = useTheme();
  const color = theme.red300;
  const SPIKE_RANGE_OFFSET = 10000000;

  if (!data || data.length <= 0 || !spike) {
    return null;
  }

  const clampedData = data[0].data.filter(
    bucket =>
      spike?.startTimestamp - SPIKE_RANGE_OFFSET <= parseInt(bucket.name as string, 10) &&
      parseInt(bucket.name as string, 10) <= spike?.endTimestamp + SPIKE_RANGE_OFFSET
  );

  const series = [
    {
      color,
      data: clampedData,
      seriesName: 'Failure Rate',
    },
    {
      seriesName: 'Focused Area',
      color,
      data: [],
      silent: false,
      emphasis: {disabled: false},
      markArea: MarkArea({
        silent: true,
        itemStyle: {
          color,
          opacity: 0.2,
        },
        label: {
          show: false,
        },
        data: [
          [
            {name: 'start', xAxis: spike.startTimestamp, emphasis: {disabled: false}},
            {name: 'end', xAxis: spike.endTimestamp, emphasis: {disabled: false}},
          ],
        ],
      }),
    },
  ];

  const yAxis: YAXisOption = {
    splitNumber: 3,
    type: 'value',
    axisLabel: {
      color: theme.chartLabel,
      formatter: (value: number) => formatAbbreviatedNumber(value),
    },
  };

  const chartProps = {
    seriesOptions: {
      showSymbol: false,
    },
    isGroupedByDate: true,
    showTimeInTooltip: true,
    color,
    tooltip: {
      trigger: 'axis',
      valueFormatter: value => {
        return tooltipFormatter(value, 'number');
      },
    },
    grid: {
      left: '0',
      right: '0',
      top: '8px',
      bottom: '0',
    },
  } as Omit<AreaChartProps, 'series'>;

  return (
    <ChartPanel title={t('5xx Responses')}>
      <LineChart height={120} series={series} yAxis={yAxis} {...chartProps} />
    </ChartPanel>
  );
}

export default FocusedFailureRateChart;
