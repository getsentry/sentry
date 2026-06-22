import {getDiffInMinutes} from 'sentry/components/charts/utils';
import type {PageFilters} from 'sentry/types/core';
import {defined} from 'sentry/utils/defined';
import {closestIntervalToDuration} from 'sentry/utils/duration/closestIntervalToDuration';
import {intervalToMilliseconds} from 'sentry/utils/duration/intervalToMilliseconds';
import {PIXELS_PER_BUCKET} from 'sentry/views/dashboards/widgets/heatMapWidget/settings';

/**
 * Calculates the bucket dimensions for a given heat map. The bucket selection
 * depends on the dimensions of the chart, the selected time range, and the
 * available intervals. The dimensions of the chart depend on the layout, the
 * available intervals depend on the current UI (e.g., Explore might have
 * different available intervals from another UI), and the current selected time
 * range. We aim to make square heat map cells. We first calculate which of the
 * available intervals is most closely matches the desired pixel width. Then we
 * calculate the exact number of Y-axis buckets that will make square cells. The
 * output can be fed directly to the heat map API.
 */
export function calculateHeatMapBucketDimensions(
  selection: PageFilters,
  dimensions: CartesianDimensions,
  availableIntervals: string[]
): BucketDimensions | null {
  if (
    dimensions.width <= 0 ||
    dimensions.height <= 0 ||
    availableIntervals.length === 0
  ) {
    return null;
  }

  const timeRangeAsMilliseconds = getDiffInMinutes(selection.datetime) * 60 * 1000;

  const bucketWidthAsMilliseconds = Math.round(
    timeRangeAsMilliseconds / (dimensions.width / PIXELS_PER_BUCKET)
  );

  const interval = closestIntervalToDuration(
    bucketWidthAsMilliseconds,
    availableIntervals
  );

  if (!defined(interval)) {
    return null;
  }

  const intervalAsMilliseconds = intervalToMilliseconds(interval);
  const intervalAsPixels = Math.round(
    (intervalAsMilliseconds / timeRangeAsMilliseconds) * dimensions.width
  );

  if (intervalAsPixels <= 0) {
    return null;
  }

  const yBuckets = Math.round(dimensions.height / intervalAsPixels);

  if (yBuckets <= 0) {
    return null;
  }

  return {
    interval,
    yBuckets,
  };
}

type BucketDimensions = {
  interval: string;
  yBuckets: number;
};

type CartesianDimensions = {
  height: number;
  width: number;
};
