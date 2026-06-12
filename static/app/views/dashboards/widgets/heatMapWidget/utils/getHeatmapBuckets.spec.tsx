import type {PageFilters} from 'sentry/types/core';
import {
  getHeatmapXBucketInterval,
  getHeatmapYBuckets,
} from 'sentry/views/dashboards/widgets/heatMapWidget/utils/getHeatmapBuckets';

const INTERVAL_OPTIONS = [
  {label: '1 minute', value: '1m'},
  {label: '5 minutes', value: '5m'},
  {label: '10 minutes', value: '10m'},
  {label: '30 minutes', value: '30m'},
  {label: '1 hour', value: '1h'},
  {label: '3 hours', value: '3h'},
  {label: '6 hours', value: '6h'},
  {label: '12 hours', value: '12h'},
];

function makeSelection(period: string): PageFilters {
  return {
    projects: [],
    environments: [],
    datetime: {period, start: null, end: null, utc: null},
  };
}

describe('getHeatmapYBuckets()', () => {
  it('returns 0 when the container has no width', () => {
    expect(getHeatmapYBuckets(makeSelection('24h'), '1h', 0, 362)).toBe(0);
  });

  it('returns 0 for an invalid interval', () => {
    expect(getHeatmapYBuckets(makeSelection('24h'), 'not-an-interval', 700, 362)).toBe(0);
  });

  it('scales the Y bucket count by the container aspect ratio', () => {
    // 24h / 1h = 24 X buckets; 24 * (362 / 724) ≈ 12
    expect(getHeatmapYBuckets(makeSelection('24h'), '1h', 724, 362)).toBe(12);
  });

  it('never returns fewer than 1 bucket when there is data', () => {
    // A very wide, short container would round to 0 without the floor.
    expect(getHeatmapYBuckets(makeSelection('1h'), '1h', 2000, 10)).toBe(1);
  });
});

describe('getHeatmapXBucketInterval()', () => {
  it('falls back to the provided interval when the width is 0', () => {
    expect(
      getHeatmapXBucketInterval(makeSelection('24h'), '12h', 0, INTERVAL_OPTIONS)
    ).toBe('12h');
  });

  it('picks a larger interval as the container gets narrower', () => {
    const wide = getHeatmapXBucketInterval(
      makeSelection('24h'),
      '12h',
      1200,
      INTERVAL_OPTIONS
    );
    const narrow = getHeatmapXBucketInterval(
      makeSelection('24h'),
      '12h',
      300,
      INTERVAL_OPTIONS
    );
    // A narrower container fits fewer 15px columns, so each bucket spans more time.
    const toMs = (interval: string) =>
      INTERVAL_OPTIONS.findIndex(option => option.value === interval);
    expect(toMs(narrow)).toBeGreaterThan(toMs(wide));
  });

  it('only returns intervals from the provided options', () => {
    const result = getHeatmapXBucketInterval(
      makeSelection('24h'),
      '12h',
      724,
      INTERVAL_OPTIONS
    );
    expect(INTERVAL_OPTIONS.map(option => option.value)).toContain(result);
  });
});
