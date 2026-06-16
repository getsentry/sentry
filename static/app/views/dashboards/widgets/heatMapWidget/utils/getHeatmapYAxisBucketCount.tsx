import {PIXELS_PER_BUCKET} from 'sentry/views/dashboards/widgets/heatMapWidget/utils/constants';

/**
 * Computes the number of Y-axis buckets for the heatmap API. The X-axis
 * interval already targets ~`PIXELS_PER_BUCKET`-wide columns, so we size the
 * Y axis the same way — dividing the container height by that target — to keep
 * cells roughly square.
 */
export function getHeatmapYAxisBucketCount(chartContainerHeight: number): number {
  if (chartContainerHeight <= 0) {
    return 0;
  }

  return Math.max(1, Math.round(chartContainerHeight / PIXELS_PER_BUCKET));
}
