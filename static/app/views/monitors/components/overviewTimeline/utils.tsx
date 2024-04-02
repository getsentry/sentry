import {getFormat} from 'sentry/utils/dates';

import type {TimeWindow, TimeWindowConfig} from './types';

// Stores the elapsed minutes for each selectable resolution
export const resolutionElapsedMinutes: Record<TimeWindow, number> = {
  '1h': 60,
  '24h': 60 * 24,
  '7d': 60 * 24 * 7,
  '30d': 60 * 24 * 30,
};

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

  // Display only the time (no date) when the window is less than 24 hours
  const timeOnly = elapsedMinutes <= ONE_HOUR * 24;

  const minimumWidth = timeOnly ? TIMELABEL_WIDTH_TIME : TIMELABEL_WIDTH_DATE;

  // When one pixel represents less than at least one minute we also want to
  // display second values on our labels.
  const displaySeconds = elapsedMinutes < timelineWidth;

  // Compute the smallest minute value that we are willing to space our ticks
  // apart by. This will be at least minimumWidth.

  // Calculate the minutes per pixel of the timeline
  const minutesPerPixel = elapsedMinutes / timelineWidth;

  // Calculate minutes at the minimumWidth
  const minTickMinutesApart = minutesPerPixel * minimumWidth;

  const baseConfig = {
    start,
    end,
    elapsedMinutes,
    minimumMarkerInterval: minTickMinutesApart,
  };

  for (const minutes of CLAMPED_MINUTE_RANGES) {
    if (minutes < minTickMinutesApart) {
      continue;
    }

    // Configuration falls into
    return {
      ...baseConfig,
      markerInterval: minutes,
      dateTimeProps: {timeOnly},
      dateLabelFormat: getFormat({timeOnly, seconds: displaySeconds}),
    };
  }

  // Calculate the days in between each tick marker at the minimum time
  const tickIntervalDayInMinutes =
    Math.ceil(minTickMinutesApart / (ONE_HOUR * 24)) * ONE_HOUR * 24;

  return {
    ...baseConfig,
    markerInterval: tickIntervalDayInMinutes,
    dateTimeProps: {dateOnly: true},
    dateLabelFormat: getFormat(),
  };
}

/**
 * Aligns the given date to the start of a unit (minute, hour, day) based on
 * the minuteInterval size. This will align to the right side of the boundary
 *
 * 01:53:43 (10m interval) => 01:54:00
 * 01:32:00 (2hr interval) => 02:00:00
 */
export function alignDateToBoundary(date: moment.Moment, minuteInterval: number) {
  if (minuteInterval < 60) {
    return date.minute(date.minutes() - (date.minutes() % minuteInterval)).seconds(0);
  }

  if (minuteInterval < 60 * 24) {
    return date.startOf('hour');
  }

  return date.startOf('day');
}
