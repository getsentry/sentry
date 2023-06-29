import moment from 'moment';

import {getFormat} from 'sentry/utils/dates';

import {TimeWindow, TimeWindowData} from './types';

// Stores options and data which correspond to each selectable time window
export const timeWindowConfig: TimeWindowData = {
  '1h': {
    cursorLabelFormat: getFormat({timeOnly: true, seconds: true}),
    elapsedMinutes: 60,
    timeMarkerInterval: 10,
    dateTimeProps: {timeOnly: true},
  },
  '24h': {
    cursorLabelFormat: getFormat({timeOnly: true}),
    elapsedMinutes: 60 * 24,
    timeMarkerInterval: 60 * 4,
    dateTimeProps: {timeOnly: true},
  },
  '7d': {
    cursorLabelFormat: getFormat(),
    elapsedMinutes: 60 * 24 * 7,
    timeMarkerInterval: 60 * 24,
    dateTimeProps: {},
  },
  '30d': {
    cursorLabelFormat: getFormat({dateOnly: true}),
    elapsedMinutes: 60 * 24 * 30,
    timeMarkerInterval: 60 * 24 * 5,
    dateTimeProps: {dateOnly: true},
  },
};

export function getStartFromTimeWindow(end: Date, timeWindow: TimeWindow): Date {
  const {elapsedMinutes} = timeWindowConfig[timeWindow];
  const start = moment(end).subtract(elapsedMinutes, 'minute');

  return start.toDate();
}
