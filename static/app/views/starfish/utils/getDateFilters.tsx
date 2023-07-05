import moment from 'moment';

import {PageFilters} from 'sentry/types';

export const PERIOD_REGEX = /^(\d+)([h,d])$/;
export const DATE_FORMAT = 'YYYY-MM-DD HH:mm:ss';

export function getDateFilters(selection: Partial<PageFilters['datetime']>) {
  const [_, num, unit] = selection.period?.match(PERIOD_REGEX) ?? [];
  const startTime =
    num && unit ? moment().subtract(num, unit as 'h' | 'd') : moment(selection.start);
  const endTime = moment(selection.end ?? undefined);
  return {startTime, endTime, statsPeriod: selection.period};
}
