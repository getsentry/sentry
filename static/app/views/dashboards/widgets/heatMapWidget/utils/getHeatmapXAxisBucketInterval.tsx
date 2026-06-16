import {getDiffInMinutes} from 'sentry/components/charts/utils';
import type {PageFilters} from 'sentry/types/core';
import {millisecondsToClosestInterval} from 'sentry/utils/duration/millisecondsToInterval';
import {PIXELS_PER_X_BUCKET} from 'sentry/views/dashboards/widgets/heatMapWidget/settings';

/**
 * Computes the X-axis bucket interval for the heatmap API.
 * The X-axis bucket interval is derived from the container width and the number of
 * pixels per X bucket.
 */
export function getHeatmapXAxisBucketInterval(
  selection: PageFilters,
  interval: string,
  chartContainerWidth: number,
  intervalOptions: Array<{label: string; value: string}>
): string {
  const timeRangeInMs = getDiffInMinutes(selection.datetime) * 60 * 1000;
  const msPerXBucket = Math.round(
    timeRangeInMs / (chartContainerWidth / PIXELS_PER_X_BUCKET)
  );
  const xBucketInterval = millisecondsToClosestInterval(
    msPerXBucket,
    intervalOptions.map(option => option.value)
  );
  return xBucketInterval || interval;
}
