import styled from '@emotion/styled';

import {AreaChart, AreaChartProps} from 'sentry/components/charts/areaChart';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import {formatBytesBase2} from 'sentry/utils';
import theme from 'sentry/utils/theme';

function MemoryChart({memorySpans}) {
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
      type: 'time',
      min: memorySpans[0]?.data?.timestamp,
      max: memorySpans.slice(-1)?.data?.timestamp,
    },
    yAxis: {
      type: 'value',
      name: t('Heap Size'),
      nameTextStyle: {
        padding: 8,
        fontSize: theme.fontSizeLarge,
        fontWeight: 600,
        lineHeight: 1.2,
        color: theme.gray100,
      },
      min: 0,
      max: memorySpans.slice(-1)?.data?.memory.totalJSHeapSize,
      axisLabel: {
        formatter: value => formatBytesBase2(value),
      },
    },
  };

  const series = [
    {
      seriesName: t('Used Heap Memory'),
      data: memorySpans.map((span, i) => ({
        value: span.data.memory.usedJSHeapSize,
        name: i,
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
      data: memorySpans.map((span, i) => ({
        value: span.data.memory.totalJSHeapSize - span.data.memory.usedJSHeapSize,
        name: i,
      })),
      stack: 'heap-memory',
      color: theme.green300,
      lineStyle: {
        opacity: 0.75,
        width: 1,
      },
    },
  ];
  return memorySpans.length > 0 ? (
    <MemoryChartWrapper>
      <AreaChart series={series} {...chartOptions} />
    </MemoryChartWrapper>
  ) : (
    <NoMemoryMessageWrapper>
      {t('No memory metrics exist for replay.')}
    </NoMemoryMessageWrapper>
  );
}

const MemoryChartWrapper = styled('div')`
  margin-top: -${space(0.75)};
  border-radius: ${space(0.5)};
  border: 1px solid ${p => p.theme.gray200};
`;

const NoMemoryMessageWrapper = styled('div')`
  font-weight: 600;
  font-size: ${p => p.theme.fontSizeLarge};
  padding: ${space(2)};
`;

export default MemoryChart;
