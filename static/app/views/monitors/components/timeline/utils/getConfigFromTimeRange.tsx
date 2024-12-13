import {getFormat} from 'sentry/utils/dates';

import type {TimeWindowConfig} from '../types';

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
 * The minimum pixels to allocate to each time label when it's a timestaamp.
 */
const TIMELABEL_WIDTH_TIME = 100;

const ONE_HOUR = 60;

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
  ONE_HOUR,
  ONE_HOUR * 2,
  ONE_HOUR * 4,
  ONE_HOUR * 8,
  ONE_HOUR * 12,
];

/**
 * Compute the TimeWindowConfig given the timeline date boundaries and the width
 * of the timeline.
 */

export function getConfigFromTimeRange(
  start: Date,
  end: Date,
  timelineWidth: number
): TimeWindowConfig {
  const elapsedMinutes = (end.getTime() - start.getTime()) / (1000 * 60);

  // Display only the time (no date) when the start and end times are the same day
  const timeOnly = elapsedMinutes <= ONE_HOUR * 24 && start.getDate() === end.getDate();

  // When one pixel represents less than at least one minute we also want to
  // display second values on our labels.
  const displaySeconds = elapsedMinutes < timelineWidth;

  function computeMarkerInterval(pixels: number) {
    const minutesPerPixel = elapsedMinutes / timelineWidth;
    return minutesPerPixel * pixels;
  }

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
      intervals: {...intervals, normalMarkerInterval: minutes},
      dateTimeProps: {timeOnly},
      dateLabelFormat: getFormat({timeOnly, seconds: displaySeconds}),
    };
  }

  // Calculate the days in between each tick marker at the minimum time
  const normalMarkerInterval =
    Math.ceil(minimumMarkerInterval / (ONE_HOUR * 24)) * ONE_HOUR * 24;

  return {
    start,
    end,
    elapsedMinutes,
    timelineWidth,
    intervals: {...intervals, normalMarkerInterval},
    dateTimeProps: {dateOnly: true},
    dateLabelFormat: getFormat(),
  };
}
