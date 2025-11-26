import {getChartInterval} from './chartInterval';

describe('getChartInterval', () => {
  const MAX_BUCKETS = 10_000;

  it('returns detector time window for small time ranges', () => {
    expect(
      getChartInterval({
        timeWindow: 60,
        maxBuckets: MAX_BUCKETS,
        timeRange: {statsPeriod: '6h'},
      })
    ).toBe(60);
  });

  it('snaps to 5 minute preset for 7 day time range', () => {
    expect(
      getChartInterval({
        timeWindow: 60,
        maxBuckets: MAX_BUCKETS,
        timeRange: {statsPeriod: '7d'},
      })
    ).toBe(300);
  });

  it('snaps to 15 minute preset for 90 day time range', () => {
    expect(
      getChartInterval({
        timeWindow: 60,
        maxBuckets: MAX_BUCKETS,
        timeRange: {statsPeriod: '90d'},
      })
    ).toBe(900);
  });

  it('respects detector time window when larger than calculated interval', () => {
    expect(
      getChartInterval({
        timeWindow: 3600,
        maxBuckets: MAX_BUCKETS,
        timeRange: {statsPeriod: '6h'},
      })
    ).toBe(3600);
  });

  it('returns detector time window when time range is invalid', () => {
    expect(
      getChartInterval({
        timeWindow: 60,
        maxBuckets: MAX_BUCKETS,
        timeRange: {},
      })
    ).toBe(60);
  });

  it('works with absolute start/end dates', () => {
    // 7 days via absolute dates
    const start = '2024-01-01T00:00:00Z';
    const end = '2024-01-08T00:00:00Z';
    expect(
      getChartInterval({
        timeWindow: 60,
        maxBuckets: MAX_BUCKETS,
        timeRange: {start, end},
      })
    ).toBe(300); // 5 minutes
  });

  it('respects custom maxBuckets limit', () => {
    // 7 days = 604,800 seconds
    // With maxBuckets = 1000: rawMinInterval = ceil(604800 / 1000) = 605 seconds
    // Snaps to 900 seconds (15 minutes)
    expect(
      getChartInterval({
        timeWindow: 60,
        maxBuckets: 1000,
        timeRange: {statsPeriod: '7d'},
      })
    ).toBe(900);
  });
});
