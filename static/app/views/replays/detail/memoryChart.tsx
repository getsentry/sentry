import styled from '@emotion/styled';

import {AreaChart, AreaChartProps} from 'sentry/components/charts/areaChart';
import {MemorySpanType} from 'sentry/components/events/interfaces/spans/types';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import {formatBytesBase2} from 'sentry/utils';
import {getFormattedDate} from 'sentry/utils/dates';
import theme from 'sentry/utils/theme';
import EmptyMessage from 'sentry/views/settings/components/emptyMessage';

type Props = {
  memorySpans: MemorySpanType[] | undefined;
};

const formatTimestamp = timestamp =>
  getFormattedDate(timestamp * 1000, 'MMM D, YYYY HH:mm:ss');

function MemoryChart({memorySpans = []}: Props) {
  if (memorySpans.length <= 0) {
    return <EmptyMessage>{t('No memory metrics exist for replay.')}</EmptyMessage>;
  }

  const chartOptions: Omit<AreaChartProps, 'series'> = {
    grid: {
      left: '10px',
      right: '10px',
      top: '40px',
      bottom: '10px',
    },
    tooltip: {
      trigger: 'axis',
      valueFormatter: (value: number | null) => formatBytesBase2(value || 0),
    },
    xAxis: {
      type: 'category',
      min: formatTimestamp(memorySpans[0]?.timestamp),
      max: formatTimestamp(memorySpans[memorySpans.length - 1]?.timestamp),
    },
    yAxis: {
      type: 'value',
      name: t('Heap Size'),
      nameTextStyle: {
        padding: 8,
        fontSize: theme.fontSizeLarge,
        fontWeight: 600,
        lineHeight: 1.2,
        color: theme.gray300,
      },
      min: 0,
      // we don't set a max because we let echarts figure it out for us
      axisLabel: {
        formatter: value => formatBytesBase2(value),
      },
    },
  };

  const series = [
    {
      seriesName: t('Used Heap Memory'),
      data: memorySpans.map(span => ({
        value: span.data.memory.usedJSHeapSize,
        name: formatTimestamp(span.timestamp),
      })),
      stack: 'heap-memory',
      color: theme.purple300,
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
      color: theme.green300,
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
