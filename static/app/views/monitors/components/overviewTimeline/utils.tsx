import moment from 'moment';

import {getFormat} from 'sentry/utils/dates';

import {TimeWindow, TimeWindowOptions} from './types';

// Stores the elapsed minutes for each selectable resolution
export const resolutionElapsedMinutes: Record<TimeWindow, number> = {
  '1h': 60,
  '24h': 60 * 24,
  '7d': 60 * 24 * 7,
  '30d': 60 * 24 * 30,
};

export function getStartFromTimeWindow(end: Date, timeWindow: TimeWindow): Date {
  const start = moment(end).subtract(resolutionElapsedMinutes[timeWindow], 'minute');

  return start.toDate();
}

// The pixels to allocate to each time label based on (MMM DD HH:SS AM/PM)
const TIMELABEL_WIDTH = 100;

export function getConfigFromTimeRange(
  start: Date,
  end: Date,
  timelineWidth: number
): TimeWindowOptions {
  // Acceptable intervals between time labels, in minutes
  const minuteRanges = [1, 10, 30, 60, 4 * 60, 8 * 60, 12 * 60];
  const startEndMinutes = (end.getTime() - start.getTime()) / (1000 * 60);
  const timeLabelMinutes = startEndMinutes * (TIMELABEL_WIDTH / timelineWidth);
  const subMinutePxBuckets = startEndMinutes < timelineWidth;

  for (const minutes of minuteRanges) {
    if (minutes >= Math.floor(timeLabelMinutes)) {
      return {
        dateLabelFormat: getFormat({timeOnly: true, seconds: subMinutePxBuckets}),
        elapsedMinutes: startEndMinutes,
        timeMarkerInterval: minutes,
        dateTimeProps: {timeOnly: true},
      };
    }
  }

  // Calculate days between each time label interval for larger time ranges
  const timeLabelIntervalDays = Math.ceil(timeLabelMinutes / (60 * 24));
  return {
    dateLabelFormat: getFormat(),
    elapsedMinutes: startEndMinutes,
    timeMarkerInterval: timeLabelIntervalDays * 60 * 24,
    dateTimeProps: {dateOnly: true},
  };
}
