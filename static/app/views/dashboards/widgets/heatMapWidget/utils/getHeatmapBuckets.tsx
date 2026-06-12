import {getDiffInMinutes} from 'sentry/components/charts/utils';
import type {PageFilters} from 'sentry/types/core';
import {intervalToMilliseconds} from 'sentry/utils/duration/intervalToMilliseconds';
import {millisecondsToClosestInterval} from 'sentry/utils/duration/millisecondsToInterval';

/**
 * Target width, in pixels, of a single X-axis (time) bucket. The X-axis bucket
 * interval is chosen so that each time column is at least this wide.
 */
export const PIXELS_PER_X_BUCKET = 15;

/**
 * Computes the number of Y-axis buckets for the heatmap API so that cells
 * are roughly square. The X-axis bucket count comes from the time range
 * divided by the selected interval. We derive Y buckets by scaling
 * xBuckets by the container's height/width aspect ratio.
 */
export function getHeatmapYBuckets(
  selection: PageFilters,
  interval: string,
  chartContainerWidth: number,
  chartContainerHeight: number
): number {
  const timeRangeInMs = getDiffInMinutes(selection.datetime) * 60 * 1000;
  const intervalInMs = intervalToMilliseconds(interval);
  if (intervalInMs <= 0 || chartContainerWidth <= 0) {
    return 0;
  }
  const xBuckets = Math.round(timeRangeInMs / intervalInMs);
  if (xBuckets <= 0) {
    return 0;
  }

  return Math.max(1, Math.round(xBuckets * (chartContainerHeight / chartContainerWidth)));
}

/**
 * Computes the X-axis bucket interval for the heatmap API.
 * The X-axis bucket interval is derived from the container width and the number of
 * pixels per X bucket.
 */
export function getHeatmapXBucketInterval(
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
