import moment from 'moment';

import {TimeWindow, TimeWindowData} from './types';

// Stores options and data which correspond to each selectable time window
export const timeWindowData: TimeWindowData = {
  '1h': {elapsedMinutes: 60, timeMarkerInterval: 10, dateTimeProps: {timeOnly: true}},
  '24h': {
    elapsedMinutes: 60 * 24,
    timeMarkerInterval: 60 * 4,
    dateTimeProps: {timeOnly: true},
  },
  '7d': {elapsedMinutes: 60 * 24 * 7, timeMarkerInterval: 60 * 24, dateTimeProps: {}},
  '30d': {
    elapsedMinutes: 60 * 24 * 30,
    timeMarkerInterval: 60 * 24 * 5,
    dateTimeProps: {dateOnly: true},
  },
};

export function getStartFromTimeWindow(end: Date, timeWindow: TimeWindow): Date {
  const {elapsedMinutes} = timeWindowData[timeWindow];
  const start = moment(end).subtract(elapsedMinutes, 'minute');

  return start.toDate();
}
