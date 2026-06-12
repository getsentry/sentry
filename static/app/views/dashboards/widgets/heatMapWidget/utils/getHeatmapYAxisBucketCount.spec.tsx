import type {PageFilters} from 'sentry/types/core';
import {getHeatmapYAxisBucketCount} from 'sentry/views/dashboards/widgets/heatMapWidget/utils/getHeatmapYAxisBucketCount';

function makeSelection(period: string): PageFilters {
  return {
    projects: [],
    environments: [],
    datetime: {period, start: null, end: null, utc: null},
  };
}

describe('getHeatmapYAxisBucketCount()', () => {
  it('returns 0 when the container has no width', () => {
    expect(getHeatmapYAxisBucketCount(makeSelection('24h'), '1h', 0, 362)).toBe(0);
  });

  it('returns 0 for an invalid interval', () => {
    expect(
      getHeatmapYAxisBucketCount(makeSelection('24h'), 'not-an-interval', 700, 362)
    ).toBe(0);
  });

  it('scales the Y bucket count by the container aspect ratio', () => {
    // 24h / 1h = 24 X buckets; 24 * (362 / 724) ≈ 12
    expect(getHeatmapYAxisBucketCount(makeSelection('24h'), '1h', 724, 362)).toBe(12);
  });

  it('never returns fewer than 1 bucket when there is data', () => {
    // A very wide, short container would round to 0 without the floor.
    expect(getHeatmapYAxisBucketCount(makeSelection('1h'), '1h', 2000, 10)).toBe(1);
  });
});
