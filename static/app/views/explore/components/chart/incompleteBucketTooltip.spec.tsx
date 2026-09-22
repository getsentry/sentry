import {OrganizationFixture} from 'sentry-fixture/organization';

import {renderHookWithProviders} from 'sentry-test/reactTestingLibrary';

import type {TimeSeries} from 'sentry/views/dashboards/widgets/common/types';
import {useIncompleteBucketTooltipDetails} from 'sentry/views/explore/components/chart/incompleteBucketTooltip';
import type {ChartInfo} from 'sentry/views/explore/components/chart/types';
import {ChartType} from 'sentry/views/insights/common/components/chart';

const ONE_HOUR_IN_MS = 3600000;
const COMPLETE_TIMESTAMP = 1758153600000;
const INCOMPLETE_TIMESTAMP = COMPLETE_TIMESTAMP + ONE_HOUR_IN_MS;

function makeSeries(): TimeSeries {
  return {
    yAxis: 'count(span.duration)',
    meta: {
      valueType: 'integer',
      valueUnit: null,
      interval: ONE_HOUR_IN_MS,
    },
    values: [
      {timestamp: COMPLETE_TIMESTAMP, value: 10, incomplete: false},
      {
        timestamp: INCOMPLETE_TIMESTAMP,
        value: 2,
        incomplete: true,
        incompleteReason: 'INCOMPLETE_BUCKET',
      },
    ],
  };
}

function makeChartInfo(meta?: Record<string, unknown>): ChartInfo {
  return {
    chartType: ChartType.BAR,
    series: [makeSeries()],
    yAxis: 'count(span.duration)',
    timeseriesResult: {meta} as ChartInfo['timeseriesResult'],
  };
}

function renderTooltipDetails(
  chartInfo: ChartInfo,
  features: string[] = ['measured-ingestion-delay-ui']
) {
  return renderHookWithProviders(() => useIncompleteBucketTooltipDetails(chartInfo), {
    organization: OrganizationFixture({features}),
  });
}

describe('useIncompleteBucketTooltipDetails', () => {
  it('adds ingestion delay information to incomplete buckets when measured', () => {
    const {result} = renderTooltipDetails(
      makeChartInfo({
        completeThrough: INCOMPLETE_TIMESTAMP,
        estimatedIngestionDelaySeconds: 60,
      })
    );

    expect(result.current).toBeDefined();
    expect(result.current!(['count(span.duration)'], INCOMPLETE_TIMESTAMP)).toContain(
      'Event ingestion is incomplete.'
    );
    expect(result.current!(['count(span.duration)'], INCOMPLETE_TIMESTAMP)).toContain(
      'Check again in ~1 hour.'
    );
  });

  it('does not add ingestion delay information to complete buckets', () => {
    const {result} = renderTooltipDetails(
      makeChartInfo({completeThrough: INCOMPLETE_TIMESTAMP})
    );

    expect(result.current!(['count(span.duration)'], COMPLETE_TIMESTAMP)).toBe('');
  });
});
