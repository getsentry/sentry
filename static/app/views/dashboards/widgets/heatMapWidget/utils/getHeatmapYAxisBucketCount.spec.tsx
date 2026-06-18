import {PageFiltersFixture} from 'sentry-fixture/pageFilters';

import {getHeatmapYAxisBucketCount} from 'sentry/views/dashboards/widgets/heatMapWidget/utils/getHeatmapYAxisBucketCount';

function makeSelection(period: string) {
  return PageFiltersFixture({datetime: {period, start: null, end: null, utc: null}});
}

describe('getHeatmapYAxisBucketCount()', () => {
  it('returns 0 before the container has been measured', () => {
    expect(getHeatmapYAxisBucketCount(makeSelection('24h'), '1h', 0)).toBe(0);
  });

  it('returns 0 for a non-positive interval', () => {
    expect(getHeatmapYAxisBucketCount(makeSelection('24h'), '0', 800)).toBe(0);
  });

  it('returns a positive bucket count once the container is measured', () => {
    expect(
      getHeatmapYAxisBucketCount(makeSelection('24h'), '1h', 800)
    ).toBeGreaterThanOrEqual(1);
  });

  it('fits fewer Y buckets into a wider container', () => {
    const narrow = getHeatmapYAxisBucketCount(makeSelection('24h'), '1h', 400);
    const wide = getHeatmapYAxisBucketCount(makeSelection('24h'), '1h', 1600);
    expect(wide).toBeLessThanOrEqual(narrow);
  });
});
