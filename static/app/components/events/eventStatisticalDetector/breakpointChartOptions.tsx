import type {Theme} from '@emotion/react';

import {ChartType} from 'sentry/chartcuterie/types';
import type {BaseChartProps} from 'sentry/components/charts/baseChart';
import VisualMap from 'sentry/components/charts/components/visualMap';
import type {EventsStatsData, EventsStatsSeries} from 'sentry/types/organization';
import {
  axisLabelFormatter,
  getDurationUnit,
  tooltipFormatter,
} from 'sentry/utils/discover/charts';
import {aggregateOutputType} from 'sentry/utils/discover/fields';
import {
  TrendFunctionField,
  type NormalizedTrendsTransaction,
} from 'sentry/views/performance/trends/types';
import generateTrendFunctionAsString from 'sentry/views/performance/trends/utils/generateTrendFunctionAsString';
import transformEventStats from 'sentry/views/performance/trends/utils/transformEventStats';
import {getIntervalLine} from 'sentry/views/performance/utils/getIntervalLine';

export type EventBreakpointChartData = {
  evidenceData: BreakpointEvidenceData;
  percentileData: EventsStatsData | EventsStatsSeries<'p95()'>;
};

export type BreakpointEvidenceData = Pick<
  NormalizedTrendsTransaction,
  'aggregate_range_1' | 'aggregate_range_2' | 'breakpoint'
>;

function transformFunctionStatsToEventsStatsData(
  stats?: EventsStatsSeries<'p95()'>
): EventsStatsData {
  const rawData = stats?.data.find(({axis}) => axis === 'p95()');
  const timestamps = stats?.timestamps;
  if (!timestamps || !rawData) {
    return [];
  }
  return timestamps.map((timestamp, i) => [timestamp, [{count: rawData.values[i] ?? 0}]]);
}

function isEventsStatsData(
  percentileData: EventBreakpointChartData['percentileData']
): percentileData is EventsStatsData {
  return Array.isArray(percentileData);
}

function toEventsStatsData(
  chartType: ChartType,
  percentileData: EventBreakpointChartData['percentileData']
): EventsStatsData {
  if (chartType === ChartType.SLACK_PERFORMANCE_FUNCTION_REGRESSION) {
    return transformFunctionStatsToEventsStatsData(
      isEventsStatsData(percentileData) ? undefined : percentileData
    );
  }

  return isEventsStatsData(percentileData) ? percentileData : [];
}

function getBreakpointChartOptionsFromData(
  {percentileData, evidenceData}: EventBreakpointChartData,
  chartType: ChartType,
  theme: Theme
) {
  const transformedPercentileData = toEventsStatsData(chartType, percentileData);
  const trendFunction =
    chartType === ChartType.SLACK_PERFORMANCE_FUNCTION_REGRESSION
      ? 'function.duration'
      : 'transaction.duration';
  const breakpointMs = evidenceData.breakpoint ? evidenceData.breakpoint * 1000 : 0;

  const transformedSeries = transformEventStats(
    transformedPercentileData,
    generateTrendFunctionAsString(TrendFunctionField.P95, trendFunction)
  );

  const intervalSeries = getIntervalLine(
    theme,
    transformedSeries,
    0.5,
    true,
    evidenceData,
    true
  );

  const series = [...transformedSeries, ...intervalSeries];

  const legend = {
    right: 16,
    top: 12,
    data: transformedSeries.map(s => s.seriesName),
    selectedMode: false,
  } satisfies BaseChartProps['legend'];

  const durationUnit = getDurationUnit(series);

  const chartOptions = {
    axisPointer: {
      link: [
        {
          xAxisIndex: [0, 1],
          yAxisIndex: [0, 1],
        },
      ],
    },
    colors: [theme.colors.gray800, theme.colors.gray800],
    grid: {
      top: '40px',
      bottom: '0px',
    },
    legend,
    toolBox: {show: false},
    tooltip: {
      valueFormatter: (value, seriesName) => {
        return tooltipFormatter(value, aggregateOutputType(seriesName));
      },
    },
    xAxis: {type: 'time'},
    yAxis: {
      minInterval: durationUnit,
      axisLabel: {
        color: theme.tokens.content.secondary,
        formatter: (value: number) =>
          axisLabelFormatter(value, 'duration', undefined, durationUnit),
      },
    },
    options: {
      visualMap: VisualMap({
        show: false,
        type: 'piecewise',
        selectedMode: false,
        dimension: 0,
        pieces: [
          {
            gte: 0,
            lt: breakpointMs,
            color: theme.colors.gray800,
          },
          {
            gte: breakpointMs,
            color: theme.colors.red400,
          },
        ],
      }),
    },
  } satisfies BaseChartProps;
  return {
    series,
    chartOptions,
  };
}

export default getBreakpointChartOptionsFromData;
