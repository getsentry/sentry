import moment from 'moment';

import {DateString} from 'sentry/types';
import {getPeriodAgo, getUtcDateString, parsePeriodToHours} from 'sentry/utils/dates';

function midTimestamp(start: DateString, end: DateString): string {
  const diff = moment(end).diff(moment(start));
  const middle = moment(start).add(diff / 2);
  return getUtcDateString(middle);
}

export function getMiddleTimestamp({
  start,
  end,
  statsPeriod,
}: {
  end?: string;
  start?: string;
  statsPeriod?: string;
}) {
  if (statsPeriod) {
    const rangeStart = getPeriodAgo('hours', parsePeriodToHours(statsPeriod)).toDate();
    const rangeEnd = new Date();
    return midTimestamp(rangeStart, rangeEnd);
  }

  if (!start || !end) {
    throw new Error('start and end required');
  }

  return midTimestamp(start, end);
}
