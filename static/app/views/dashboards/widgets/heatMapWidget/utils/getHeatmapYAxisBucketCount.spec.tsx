import {getHeatmapYAxisBucketCount} from 'sentry/views/dashboards/widgets/heatMapWidget/utils/getHeatmapYAxisBucketCount';

describe('getHeatmapYAxisBucketCount()', () => {
  it('returns 0 when the container has no height', () => {
    expect(getHeatmapYAxisBucketCount(0)).toBe(0);
  });

  it('divides the container height by the target bucket size', () => {
    // 360 / 15 = 24
    expect(getHeatmapYAxisBucketCount(360)).toBe(24);
  });

  it('never returns fewer than 1 bucket when there is height', () => {
    expect(getHeatmapYAxisBucketCount(5)).toBe(1);
  });
});
