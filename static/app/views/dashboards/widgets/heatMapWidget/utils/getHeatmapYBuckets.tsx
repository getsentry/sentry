import {getDiffInMinutes} from 'sentry/components/charts/utils';
import type {PageFilters} from 'sentry/types/core';
import {intervalToMilliseconds} from 'sentry/utils/duration/intervalToMilliseconds';

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
