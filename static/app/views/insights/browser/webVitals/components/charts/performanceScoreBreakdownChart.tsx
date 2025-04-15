import styled from '@emotion/styled';

import type {Series} from 'sentry/types/echarts';
import {ORDER} from 'sentry/views/insights/browser/webVitals/components/charts/performanceScoreChart';
import type {WebVitalsScoreBreakdown} from 'sentry/views/insights/browser/webVitals/queries/storedScoreQueries/useProjectWebVitalsScoresTimeseriesQuery';
import type {WebVitals} from 'sentry/views/insights/browser/webVitals/types';
import {PerformanceScoreBreakdownChartWidget} from 'sentry/views/insights/common/components/widgets/performanceScoreBreakdownChartWidget';

export function formatTimeSeriesResultsToChartData(
  data: WebVitalsScoreBreakdown,
  segmentColors: string[],
  order: WebVitals[] = ORDER
): Series[] {
  return order.map((webVital, index) => {
    const series = data[webVital];
    const color = segmentColors[index];
    return {
      seriesName: webVital.toUpperCase(),
      data: series.map(({name, value}) => ({
        name,
        value: Math.round(value),
      })),
      color,
    };
  });
}

export function PerformanceScoreBreakdownChart() {
  return (
    <ChartContainer>
      <PerformanceScoreBreakdownChartWidget />
    </ChartContainer>
  );
}

const ChartContainer = styled('div')`
  flex: 1 1 0%;
`;
