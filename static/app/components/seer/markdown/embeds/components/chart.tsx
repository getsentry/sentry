import styled from '@emotion/styled';

import {AreaChart} from 'sentry/components/charts/areaChart';
import {BarChart} from 'sentry/components/charts/barChart';
import {LineChart} from 'sentry/components/charts/lineChart';
import {defineSeerEmbed} from 'sentry/components/seer/markdown/embeds/utils';
import {escape} from 'sentry/utils';
import {formatBytesBase2} from 'sentry/utils/bytes/formatBytesBase2';
import {formatTraceDuration} from 'sentry/utils/duration/formatTraceDuration';
import {formatAbbreviatedNumber} from 'sentry/utils/formatters';

type ChartUnit = 'number' | 'percentage' | 'duration' | 'bytes';

function formatValue(value: number, unit: ChartUnit): string {
  switch (unit) {
    case 'percentage':
      return `${formatAbbreviatedNumber(value)}%`;
    case 'duration':
      return formatTraceDuration(value);
    case 'bytes':
      return formatBytesBase2(value);
    case 'number':
    default:
      return formatAbbreviatedNumber(value);
  }
}

export const Chart = defineSeerEmbed({
  name: 'chart',
  render({
    title,
    subtitle,
    visualization,
    x_axis: xAxis,
    y_axis_unit: yAxisUnit,
    y_axis_label: yAxisLabel,
    series,
  }) {
    const chartSeries = series.map(item => ({
      seriesName: item.name,
      data: item.data.map(point => ({
        name:
          xAxis === 'time'
            ? typeof point.x === 'number'
              ? point.x
              : Date.parse(point.x)
            : point.x,
        value: point.y,
      })),
    }));
    const chartProps = {
      animation: false,
      grid: {left: 12, right: 12, top: series.length > 1 ? 36 : 12, bottom: 8},
      height: 220,
      isGroupedByDate: xAxis === 'time',
      legend: series.length > 1 ? {left: 0, top: 0} : {show: false},
      renderer: 'svg' as const,
      series: chartSeries,
      tooltip: {
        formatAxisLabel:
          xAxis === 'category' ? (value: number) => escape(String(value)) : undefined,
        valueFormatter: (value: number) => formatValue(value, yAxisUnit),
      },
      xAxis: xAxis === 'category' ? {axisLabel: {formatter: String}} : undefined,
      yAxis: {
        name: yAxisLabel,
        axisLabel: {formatter: (value: number) => formatValue(value, yAxisUnit)},
      },
    };

    return (
      <ChartFrame data-test-id="seer-chart-embed">
        <ChartHeader>
          <ChartTitle>{title}</ChartTitle>
          {subtitle && <ChartSubtitle>{subtitle}</ChartSubtitle>}
        </ChartHeader>
        {visualization === 'area' ? (
          <AreaChart {...chartProps} />
        ) : visualization === 'bar' ? (
          <BarChart {...chartProps} />
        ) : (
          <LineChart {...chartProps} />
        )}
      </ChartFrame>
    );
  },
});

const ChartFrame = styled('section')(({theme}) => ({
  background: theme.tokens.background.primary,
  border: `1px solid ${theme.tokens.border.primary}`,
  borderRadius: theme.radius.md,
  margin: `${theme.space.lg} 0`,
  overflow: 'hidden',
  padding: `${theme.space.lg} ${theme.space.xl} ${theme.space.md}`,
}));

const ChartHeader = styled('div')(({theme}) => ({
  marginBottom: theme.space.sm,
}));

const ChartTitle = styled('div')(({theme}) => ({
  color: theme.tokens.content.primary,
  fontSize: theme.font.size.md,
  fontWeight: theme.font.weight.sans.medium,
  lineHeight: 1.4,
}));

const ChartSubtitle = styled('div')(({theme}) => ({
  color: theme.tokens.content.secondary,
  fontSize: theme.font.size.sm,
  lineHeight: 1.4,
  marginTop: theme.space.xs,
}));
