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
  startTimestamp: number | undefined;
};

const formatTimestamp = timestamp =>
  getFormattedDate(timestamp * 1000, 'MMM D, YYYY hh:mm:ss A z', {local: false});

function MemoryChart({memorySpans = [], startTimestamp = 0}: Props) {
  const theme = useTheme();
  if (memorySpans.length <= 0) {
    return <EmptyMessage>{t('No memory metrics exist for replay.')}</EmptyMessage>;
  }

  const chartOptions: Omit<AreaChartProps, 'series'> = {
    grid: Grid({
      // makes space for the title
      top: '40px',
      left: space(1),
      right: space(1),
    }),
    tooltip: Tooltip({
      trigger: 'axis',
      formatter: values => {
        const seriesTooltips = values.map(
          value => `
            <div>
              <span className="tooltip-label">${value.marker}<strong>${
            value.seriesName
          }</strong></span>
          ${formatBytesBase2(value.data[1])}
            </div>
          `
        );
        const template = [
          '<div class="tooltip-series">',
          ...seriesTooltips,
          '</div>',
          `<div class="tooltip-date" style="display: inline-block; width: max-content;">${t(
            'Span Time'
          )}:
            ${formatTimestamp(values[0].axisValue)}
          </div>`,
          `<div class="tooltip-date" style="border: none;">${'Relative Time'}:
            ${getFormattedDate((values[0].axisValue - startTimestamp) * 1000, 'HH:mm:ss')}
          </div>`,
          '<div class="tooltip-arrow"></div>',
        ].join('');
        return template;
      },
    }),
    xAxis: XAxis({
      type: 'time',
      axisLabel: {
        formatter: formatTimestamp,
      },
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
      // input is in bytes, minInterval is a megabyte
      minInterval: 1024 * 1024,
      // maxInterval is a terabyte
      maxInterval: Math.pow(1024, 4),
      // format the axis labels to be whole number values
      axisLabel: {
        formatter: value => formatBytesBase2(value, 0),
      },
    }),
  };

  const series = [
    {
      seriesName: t('Used Heap Memory'),
      data: memorySpans.map(span => ({
        value: span.data.memory.usedJSHeapSize,
        name: span.timestamp,
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
        name: span.timestamp,
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
