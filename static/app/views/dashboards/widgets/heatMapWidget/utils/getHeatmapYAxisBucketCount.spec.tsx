import {getHeatmapYAxisBucketCount} from 'sentry/views/dashboards/widgets/heatMapWidget/utils/getHeatmapYAxisBucketCount';

describe('getHeatmapYAxisBucketCount()', () => {
  it('returns 0 when the container has no height', () => {
    expect(getHeatmapYAxisBucketCount(0)).toBe(0);
  });

  it('divides the container height by the target bucket size', () => {
    // 350 / 7 = 50
    expect(getHeatmapYAxisBucketCount(350)).toBe(50);
  });

  it('never returns fewer than 1 bucket when there is height', () => {
    expect(getHeatmapYAxisBucketCount(5)).toBe(1);
  });
});
