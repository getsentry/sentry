import {OrganizationFixture} from 'sentry-fixture/organization';

import {renderHookWithProviders} from 'sentry-test/reactTestingLibrary';

import type {TimeSeries} from 'sentry/views/dashboards/widgets/common/types';
import {useIncompleteBucketTooltipDetails} from 'sentry/views/explore/components/chart/incompleteBucketTooltip';

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
        incompleteReason: 'INGESTION_PENDING',
      },
    ],
  };
}

function renderTooltipDetails(
  completeThrough: number | undefined,
  features: string[] = ['measured-ingestion-delay-ui']
) {
  const series = [makeSeries()];
  return renderHookWithProviders(
    () => useIncompleteBucketTooltipDetails(series, completeThrough),
    {organization: OrganizationFixture({features})}
  );
}

describe('useIncompleteBucketTooltipDetails', () => {
  it('adds ingestion delay information to incomplete buckets when measured', () => {
    const {result} = renderTooltipDetails(INCOMPLETE_TIMESTAMP);

    expect(result.current).toBeDefined();
    expect(result.current!(['count(span.duration)'], INCOMPLETE_TIMESTAMP)).toContain(
      'Event ingestion is incomplete.'
    );
    expect(result.current!(['count(span.duration)'], INCOMPLETE_TIMESTAMP)).toContain(
      'Check again in ~1 hour.'
    );
  });

  it('does not add ingestion delay information to complete buckets', () => {
    const {result} = renderTooltipDetails(INCOMPLETE_TIMESTAMP);

    expect(result.current!(['count(span.duration)'], COMPLETE_TIMESTAMP)).toBe('');
  });
});
