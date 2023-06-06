import moment from 'moment';

import {DateTimeObject} from 'sentry/components/charts/utils';
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

export const PERIOD_REGEX = /^(\d+)([h,d])$/;
export const DATE_FORMAT = 'YYYY-MM-DD HH:mm:ss';

export const datetimeToClickhouseFilterTimestamps = (datetime?: DateTimeObject) => {
  if (!datetime) {
    return {};
  }
  const [_, num, unit] = datetime.period?.match(PERIOD_REGEX) ?? [];
  const start_timestamp =
    (datetime.start && moment(datetime.start).format(DATE_FORMAT)) ??
    (num &&
      unit &&
      moment()
        .subtract(num, unit as 'h' | 'd')
        .startOf('minute')
        .format(DATE_FORMAT));

  const end_timestamp = datetime.end && moment(datetime.end).format(DATE_FORMAT);
  return {start_timestamp, end_timestamp};
};

export function getDateFilters(pageFilter) {
  const [_, num, unit] = pageFilter.selection.datetime.period?.match(PERIOD_REGEX) ?? [];
  const startTime =
    num && unit
      ? moment().subtract(num, unit as 'h' | 'd')
      : moment(pageFilter.selection.datetime.start);
  const endTime = moment(pageFilter.selection.datetime.end ?? undefined);
  return {startTime, endTime};
}
