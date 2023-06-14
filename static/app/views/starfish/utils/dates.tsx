import moment from 'moment';

export const PERIOD_REGEX = /^(\d+)([h,d])$/;
export const DATE_FORMAT = 'YYYY-MM-DD HH:mm:ss';

export function getDateFilters(pageFilter) {
  const [_, num, unit] = pageFilter.selection.datetime.period?.match(PERIOD_REGEX) ?? [];
  const startTime =
    num && unit
      ? moment().subtract(num, unit as 'h' | 'd')
      : moment(pageFilter.selection.datetime.start);
  const endTime = moment(pageFilter.selection.datetime.end ?? undefined);
  return {startTime, endTime};
}
