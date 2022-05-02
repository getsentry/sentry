import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';

import {AreaChart, AreaChartProps} from 'sentry/components/charts/areaChart';
import Grid from 'sentry/components/charts/components/grid';
import Tooltip from 'sentry/components/charts/components/tooltip';
import XAxis from 'sentry/components/charts/components/xAxis';
import YAxis from 'sentry/components/charts/components/yAxis';
import {MemorySpanType} from 'sentry/components/events/interfaces/spans/types';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import {formatBytesBase2} from 'sentry/utils';
import {getFormattedDate} from 'sentry/utils/dates';
import EmptyMessage from 'sentry/views/settings/components/emptyMessage';

type Props = {
  memorySpans: MemorySpanType[] | undefined;
};

const formatTimestamp = timestamp =>
  getFormattedDate(timestamp * 1000, 'MMM D, YYYY HH:mm:ss');

const getRoundedMemorySizeFromBytes = bytes => {
  const convertedValue = formatBytesBase2(bytes);
  const values = convertedValue.split(' ');
  // we round the byte size to the nearest ten and put the string back together
  return `${Math.round(Number(values?.[0] || 0) / 10) * 10} ${values[1]}`;
};

function MemoryChart({memorySpans = []}: Props) {
  const theme = useTheme();
  if (memorySpans.length <= 0) {
    return <EmptyMessage>{t('No memory metrics exist for replay.')}</EmptyMessage>;
  }

  const chartOptions: Omit<AreaChartProps, 'series'> = {
    grid: Grid({
      top: '40px',
      left: '100px',
    }),
    tooltip: Tooltip({
      trigger: 'axis',
      valueFormatter: (value: number | null) => formatBytesBase2(value || 0),
    }),
    xAxis: XAxis({
      type: 'category',
      min: formatTimestamp(memorySpans[0]?.timestamp),
      max: formatTimestamp(memorySpans[memorySpans.length - 1]?.timestamp),
      theme,
    }),
    yAxis: YAxis({
      type: 'value',
      name: t('Heap Size'),
      theme,
      nameTextStyle: {
        padding: 8,
        fontSize: theme.fontSizeLarge,
        fontWeight: 600,
        lineHeight: 1.2,
        color: theme.gray300,
      },
      min: 0,
      minInterval: 1,
      // we don't set a max because we let echarts figure it out for us
      axisLabel: {
        formatter: value => getRoundedMemorySizeFromBytes(value),
      },
    }),
  };

  const series = [
    {
      seriesName: t('Used Heap Memory'),
      data: memorySpans.map(span => ({
        value: span.data.memory.usedJSHeapSize,
        name: formatTimestamp(span.timestamp),
      })),
      stack: 'heap-memory',
      lineStyle: {
        opacity: 0.75,
        width: 1,
      },
    },
    {
      seriesName: t('Free Heap Memory'),
      data: memorySpans.map(span => ({
        value: span.data.memory.totalJSHeapSize - span.data.memory.usedJSHeapSize,
        name: formatTimestamp(span.timestamp),
      })),
      stack: 'heap-memory',
      lineStyle: {
        opacity: 0.75,
        width: 1,
      },
    },
  ];
  return (
    <MemoryChartWrapper>
      <AreaChart series={series} {...chartOptions} />
    </MemoryChartWrapper>
  );
}

const MemoryChartWrapper = styled('div')`
  margin-top: ${space(2)};
  margin-bottom: ${space(3)};
  border-radius: ${space(0.5)};
  border: 1px solid ${p => p.theme.border};
`;

export default MemoryChart;
