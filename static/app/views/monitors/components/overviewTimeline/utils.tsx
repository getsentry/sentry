import {getFormat} from 'sentry/utils/dates';

import type {TimeWindow, TimeWindowConfig} from './types';

// Stores the elapsed minutes for each selectable resolution
export const resolutionElapsedMinutes: Record<TimeWindow, number> = {
  '1h': 60,
  '24h': 60 * 24,
  '7d': 60 * 24 * 7,
  '30d': 60 * 24 * 30,
};

// The pixels to allocate to each time label based on (MMM DD HH:SS AM/PM)
const TIMELABEL_WIDTH = 100;

const ONE_HOUR = 60;

/**
 * Acceptable minute durations between time labels. These will be used to
 * create the TimeWindowConfig when the start and end times fit into these
 * buckets
 */
const CLAMPED_MINUTE_RANGES = [
  1,
  10,
  30,
  ONE_HOUR,
  ONE_HOUR * 4,
  ONE_HOUR * 8,
  ONE_HOUR * 12,
];

export function getConfigFromTimeRange(
  start: Date,
  end: Date,
  timelineWidth: number
): TimeWindowConfig {
  const elapsedMinutes = (end.getTime() - start.getTime()) / (1000 * 60);

  const timeLabelMinutes = elapsedMinutes * (TIMELABEL_WIDTH / timelineWidth);
  const subMinutePxBuckets = elapsedMinutes < timelineWidth;

  for (const minutes of CLAMPED_MINUTE_RANGES) {
    if (minutes < Math.floor(timeLabelMinutes)) {
      continue;
    }

    // Configuration falls into
    return {
      dateLabelFormat: getFormat({timeOnly: true, seconds: subMinutePxBuckets}),
      elapsedMinutes,
      timeMarkerInterval: minutes,
      dateTimeProps: {timeOnly: true},
    };
  }

  // Calculate days between each time label interval for larger time ranges
  const timeLabelIntervalDays = Math.ceil(timeLabelMinutes / (ONE_HOUR * 24));
  return {
    dateLabelFormat: getFormat(),
    elapsedMinutes,
    timeMarkerInterval: timeLabelIntervalDays * ONE_HOUR * 24,
    dateTimeProps: {dateOnly: true},
  };
}
