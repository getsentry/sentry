import {renderHookWithProviders} from 'sentry-test/reactTestingLibrary';

import type {TimeSeries} from 'sentry/views/dashboards/widgets/common/types';
import {useIncompleteBucketTooltipDetails} from 'sentry/views/explore/components/chart/incompleteBucketTooltip';
import type {ChartInfo} from 'sentry/views/explore/components/chart/types';
import {ChartType} from 'sentry/views/insights/common/components/chart';

const COMPLETE_TIMESTAMP = 1758153600000;
const INCOMPLETE_TIMESTAMP = 1758157200000;

function makeSeries(): TimeSeries {
  return {
    yAxis: 'count(span.duration)',
    meta: {
      valueType: 'integer',
      valueUnit: null,
      interval: 3600000,
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

describe('useIncompleteBucketTooltipDetails', () => {
  it('annotates incomplete buckets when the ingestion delay was measured', () => {
    const {result} = renderHookWithProviders(() =>
      useIncompleteBucketTooltipDetails(
        makeChartInfo({completeThrough: INCOMPLETE_TIMESTAMP})
      )
    );

    expect(result.current).toBeDefined();
    expect(result.current!(['count(span.duration)'], INCOMPLETE_TIMESTAMP)).toContain(
      'Event ingestion for this bucket is incomplete.'
    );
  });

  it('names the measured delay, rounded to the largest unit', () => {
    const {result} = renderHookWithProviders(() =>
      useIncompleteBucketTooltipDetails(
        makeChartInfo({
          completeThrough: INCOMPLETE_TIMESTAMP,
          estimatedIngestionDelaySeconds: 355.4,
        })
      )
    );

    expect(result.current!(['count(span.duration)'], INCOMPLETE_TIMESTAMP)).toContain(
      'Event ingestion for this bucket is incomplete and currently takes ~7 minutes.'
    );
  });

  it('says how long until the bucket settles', () => {
    const {result} = renderHookWithProviders(() =>
      useIncompleteBucketTooltipDetails(
        makeChartInfo({completeThrough: INCOMPLETE_TIMESTAMP})
      )
    );

    expect(result.current!(['count(span.duration)'], INCOMPLETE_TIMESTAMP)).toContain(
      'Check again in ~1 hour.'
    );
  });

  it('omits the wait once the bucket is already settling', () => {
    const chartInfo = makeChartInfo({
      completeThrough: INCOMPLETE_TIMESTAMP + 3600000,
    });

    const {result} = renderHookWithProviders(() =>
      useIncompleteBucketTooltipDetails(chartInfo)
    );

    const html = result.current!(['count(span.duration)'], INCOMPLETE_TIMESTAMP);

    expect(html).toContain('is incomplete');
    expect(html).not.toContain('Check again');
  });

  it('falls back to seconds for a short wait', () => {
    const {result} = renderHookWithProviders(() =>
      useIncompleteBucketTooltipDetails(
        makeChartInfo({completeThrough: INCOMPLETE_TIMESTAMP + 3600000 - 45000})
      )
    );

    expect(result.current!(['count(span.duration)'], INCOMPLETE_TIMESTAMP)).toContain(
      'Check again in ~45 seconds.'
    );
  });

  it('styles the headline and the follow-up differently', () => {
    const {result} = renderHookWithProviders(() =>
      useIncompleteBucketTooltipDetails(
        makeChartInfo({completeThrough: INCOMPLETE_TIMESTAMP})
      )
    );

    const html = result.current!(['count(span.duration)'], INCOMPLETE_TIMESTAMP);

    expect(html).toMatch(/<div style="color: [^"]+">Event ingestion/);
    expect(html).toMatch(/<div style="font-size: [^"]+">Check again/);
  });

  it('separates the note from the series rows with a divider', () => {
    const {result} = renderHookWithProviders(() =>
      useIncompleteBucketTooltipDetails(
        makeChartInfo({completeThrough: INCOMPLETE_TIMESTAMP})
      )
    );

    const html = result.current!(['count(span.duration)'], INCOMPLETE_TIMESTAMP);

    expect(html).toContain('border-top: solid 1px');
    expect(html).toContain('calc(-1 * 16px)');
  });

  it('gives the note a floor width and fills anything wider', () => {
    const {result} = renderHookWithProviders(() =>
      useIncompleteBucketTooltipDetails(
        makeChartInfo({completeThrough: INCOMPLETE_TIMESTAMP})
      )
    );

    const html = result.current!(['count(span.duration)'], INCOMPLETE_TIMESTAMP);

    expect(html).toMatch(/width: \d+px/);
    expect(html).toContain('min-width: 100%');
    expect(html).toContain('white-space: normal');
    expect(html).toMatch(/border-top:[^"]*"><div style="width: \d+px/);
  });

  it('leaves complete buckets alone', () => {
    const {result} = renderHookWithProviders(() =>
      useIncompleteBucketTooltipDetails(
        makeChartInfo({completeThrough: INCOMPLETE_TIMESTAMP})
      )
    );

    expect(result.current!(['count(span.duration)'], COMPLETE_TIMESTAMP)).toBe('');
  });

  it('does not annotate when the delay is the static fallback', () => {
    const {result} = renderHookWithProviders(() =>
      useIncompleteBucketTooltipDetails(makeChartInfo({}))
    );

    expect(result.current).toBeUndefined();
  });

  it('does not annotate when no bucket is incomplete', () => {
    const chartInfo = makeChartInfo({completeThrough: INCOMPLETE_TIMESTAMP});
    chartInfo.series[0]!.values.forEach(value => {
      value.incomplete = false;
    });

    const {result} = renderHookWithProviders(() =>
      useIncompleteBucketTooltipDetails(chartInfo)
    );

    expect(result.current).toBeUndefined();
  });
});
