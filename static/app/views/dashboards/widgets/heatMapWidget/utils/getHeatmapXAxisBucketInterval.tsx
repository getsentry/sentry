import {getDiffInMinutes} from 'sentry/components/charts/utils';
import type {PageFilters} from 'sentry/types/core';
import {millisecondsToClosestInterval} from 'sentry/utils/duration/millisecondsToInterval';
import {getIntervalOptionsForPageFilter} from 'sentry/utils/useChartInterval';
import {PIXELS_PER_BUCKET} from 'sentry/views/dashboards/widgets/heatMapWidget/utils/constants';

/**
 * Computes the X-axis (time) bucket interval for the heatmap API. We target
 * ~`PIXELS_PER_BUCKET`-wide columns for the given width and snap that to the
 * closest interval the current date range supports. Falls back to the largest
 * available interval (e.g. before the container has been measured).
 */
export function getHeatmapXAxisBucketInterval(
  selection: PageFilters,
  chartContainerWidth: number
): string {
  const intervalOptions = getIntervalOptionsForPageFilter(selection.datetime).map(
    option => option.value
  );
  const timeRangeInMs = getDiffInMinutes(selection.datetime) * 60 * 1000;
  const msPerXBucket = Math.round(
    timeRangeInMs / (chartContainerWidth / PIXELS_PER_BUCKET)
  );

  return (
    millisecondsToClosestInterval(msPerXBucket, intervalOptions) ??
    intervalOptions[intervalOptions.length - 1] ??
    ''
  );
}
