import moment from 'moment-timezone';

import type {PageFilters} from 'sentry/types/core';

const PERIOD_REGEX = /^(\d+)([h,d])$/;

export function getDateFilters(selection: PageFilters) {
  const [_, num, unit] = selection.datetime.period?.match(PERIOD_REGEX) ?? [];
  const startTime =
    num && unit
      ? moment().subtract(num, unit as 'h' | 'd')
      : moment(selection.datetime.start);
  const endTime = moment(selection.datetime.end ?? undefined);
  return {startTime, endTime, statsPeriod: selection.datetime.period};
}
