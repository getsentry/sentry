import {getFormat} from 'sentry/utils/dates';

import type {RollupConfig, TimeWindowConfig} from '../types';

/**
 * The minimum pixels to allocate to the reference start time label which
 * always includes date, time, and timezone.
 */
const TIMELABEL_WIDTH_FULL = 115;

/**
 * The minimum pixels to allocate to each time label when it is a full date.
 */
const TIMELABEL_WIDTH_DATE = 110;

/**
 * The minimum pixels to allocate to each time label when it's a timestamp.
 */
const TIMELABEL_WIDTH_TIME = 100;

/**
 * How big must the underscan be in order for the underscan info bubble label to
 * be displayed?
 */
const MIN_UNDERSCAN_FOR_LABEL = 140;

/**
 * Acceptable minute durations between time labels. These will be used to
 * computed the timeMarkerInterval of the TimeWindow when the start and end
 * times fit into these buckets.
 */
const CLAMPED_MINUTE_RANGES = [
  1,
  5,
  10,
  20,
  30,
  60,
  60 * 2,
  60 * 4,
  60 * 8,
  60 * 12,
] as const;

const ONE_HOUR_SECS = 60 * 60;
const ONE_MINUTE_SECS = 60;

/**
 * Acceptable bucket intervals
 */
const BUCKET_INTERVALS = [
  15,
  30,
  ONE_MINUTE_SECS,
  ONE_MINUTE_SECS * 2,
  ONE_MINUTE_SECS * 5,
  ONE_MINUTE_SECS * 10,
  ONE_MINUTE_SECS * 15,
  ONE_MINUTE_SECS * 30,
  ONE_HOUR_SECS,
  ONE_HOUR_SECS * 2,
  ONE_HOUR_SECS * 3,
  ONE_HOUR_SECS * 4,
  ONE_HOUR_SECS * 12,
  ONE_HOUR_SECS * 24,
] as const;

/**
 * The absolute maximum number of buckets we can request
 */
const MAXIMUM_BUCKETS = 2016;

/**
 * Configure weight values for picking the best interval balancing granularity
 * versus underscan factor.
 */
const WEIGHTS = {
  /**
   * Weight factor to consider a larger number of buckets (higher granularity)
   * as a better candidate.
   */
  granularity: 1,
  /**
   * Weight factor to consider a smaller amount of underscan as a better
   * candidate.
   */
  underscan: 3,
  /**
   * Weight factor to consider less pixels per bucket as a better candidate.
   */
  bucketPixels: 1.5,
} as const;

const EMPTY_ROLLUP: RollupConfig = {
  interval: 0,
  bucketPixels: 0,
  totalBuckets: 0,
  timelineUnderscanWidth: 0,
  underscanPeriod: 0,
};

/**
 * Compute the "ideal" rollup interval given the size of the timeline and the
 * period of time we want to represent within the timeline.
 *
 * This attempt to find the best interval within the available
 * BUCKET_INTERVALS. To do this the timeline ends up being "under scanned" and
 * may not take the entire size of the timeline in pixels
 */
function computeRollup(elapsedSeconds: number, timelineWidth: number) {
  if (timelineWidth === 0) {
    return EMPTY_ROLLUP;
  }

  // For all candidate intervals compute a underscan size. We'll pick the
  // interval that produces the best ratio of `underscanWidth / interval`
  const candidateIntervals = BUCKET_INTERVALS.map(interval => {
    // How many buckets will fit into the total seconds. We ceil to ensure we
    // have enough buckets even when there is only a partially filled bucket.
    let virtualBuckets = Math.ceil(elapsedSeconds / interval);
    let bucketsInVirtualBucket = 1;

    // If we have too many buckets to fit into the timeline we need to put more
    // buckets into a single pixel.
    while (virtualBuckets > timelineWidth && timelineWidth > 0) {
      virtualBuckets = Math.ceil(virtualBuckets / 2);
      bucketsInVirtualBucket *= 2;
    }

    const totalBuckets = virtualBuckets * bucketsInVirtualBucket;

    const clampedTimelineWidth =
      Math.floor(timelineWidth / virtualBuckets) * virtualBuckets;

    const timelineUnderscanWidth = timelineWidth - clampedTimelineWidth;
    const underscanPct = timelineUnderscanWidth / timelineWidth;

    // How many pixels represent a single bucket. May be order of two
    // fractional pixels (0.5, 0.25, 0.125 etc)
    const bucketPixels = clampedTimelineWidth / totalBuckets;

    const underscanBuckets = Math.floor(timelineUnderscanWidth / bucketPixels);
    const underscanPeriod = underscanBuckets * interval;

    return {
      interval,
      bucketPixels,
      totalBuckets,
      timelineUnderscanWidth,
      underscanPct,
      underscanPeriod,
      underscanBuckets,
    };
  })
    // There is a maximum number of bucekts we can request.
    .filter(
      candidate => candidate.totalBuckets + candidate.underscanBuckets < MAXIMUM_BUCKETS
    );

  const maxBuckets = Math.max(...candidateIntervals.map(o => o.totalBuckets));
  const maxBucketPixels = Math.max(...candidateIntervals.map(o => o.bucketPixels));

  // Compute a score for each candidate interval based on the granularity,
  // underscan size, and bucket pixel size. We try to find a balance between a
  // low amount of underscan while still having high level of granularity
  // without the ticks being too large.
  const candidatesWithScore = candidateIntervals
    .map(candidate => {
      const normalizedGranularity = candidate.totalBuckets / maxBuckets;
      const normalizedUnderscan = 1 - candidate.underscanPct;
      const normalizedBucketPixels = 1 - candidate.bucketPixels / maxBucketPixels;

      const score =
        WEIGHTS.granularity * normalizedGranularity +
        WEIGHTS.underscan * normalizedUnderscan +
        WEIGHTS.bucketPixels * normalizedBucketPixels;

      return {score, ...candidate};
    })
    .toSorted((a, b) => b.score - a.score);

  const config: RollupConfig = candidatesWithScore
    .map(({score: _score, underscanPct: _underscanPct, ...rest}) => rest)
    .at(0)!;

  return config;
}

/**
 * Compute the TimeWindowConfig given the timeline date boundaries and the width
 * of the timeline.
 */
export function getConfigFromTimeRange(
  start: Date,
  end: Date,
  containerWidth: number
): TimeWindowConfig {
  const elapsedMinutes = (end.getTime() - start.getTime()) / (1000 * 60);
  const elapsedSeconds = elapsedMinutes * 60;

  const rollupConfig = computeRollup(elapsedSeconds, containerWidth);
  const timelineWidth = containerWidth - rollupConfig.timelineUnderscanWidth;

  // Display only the time (no date) when the start and end times are the same day
  const timeOnly =
    elapsedMinutes <= ONE_HOUR_SECS * 24 && start.getDate() === end.getDate();

  // When one pixel represents less than at least one minute we also want to
  // display second values on our labels.
  const displaySeconds = elapsedMinutes < timelineWidth;

  function computeMarkerInterval(pixels: number) {
    const minutesPerPixel = elapsedMinutes / timelineWidth;
    return minutesPerPixel * pixels;
  }

  const showUnderscanHelp = rollupConfig.timelineUnderscanWidth > MIN_UNDERSCAN_FOR_LABEL;

  // This is smallest minute value that we are willing to space our ticks
  const minMarkerWidth = timeOnly ? TIMELABEL_WIDTH_TIME : TIMELABEL_WIDTH_DATE;

  const minimumMarkerInterval = computeMarkerInterval(minMarkerWidth);
  const referenceMarkerInterval = computeMarkerInterval(TIMELABEL_WIDTH_FULL);

  const intervals = {referenceMarkerInterval, minimumMarkerInterval};

  for (const minutes of CLAMPED_MINUTE_RANGES) {
    if (minutes < minimumMarkerInterval) {
      continue;
    }

    return {
      start,
      end,
      elapsedMinutes,
      timelineWidth,
      rollupConfig,
      showUnderscanHelp,
      intervals: {...intervals, normalMarkerInterval: minutes},
      dateTimeProps: {timeOnly},
      dateLabelFormat: getFormat({timeOnly, seconds: displaySeconds}),
    };
  }

  // Calculate the days in between each tick marker at the minimum time
  const normalMarkerInterval = Math.ceil(minimumMarkerInterval / (60 * 24)) * 60 * 24;

  return {
    start,
    end,
    elapsedMinutes,
    timelineWidth,
    rollupConfig,
    showUnderscanHelp,
    intervals: {...intervals, normalMarkerInterval},
    dateTimeProps: {dateOnly: true},
    dateLabelFormat: getFormat(),
  };
}
