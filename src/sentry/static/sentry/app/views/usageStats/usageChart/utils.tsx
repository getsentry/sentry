import moment from 'moment';

import {DataCategory} from 'app/types';

import {formatUsageWithUnits} from '../utils';

export function getDateFromMoment(m: moment.Moment) {
  return m.format('MMM D');
}

export function getDateFromUnixTimestamp(timestamp: number) {
  const date = moment.unix(timestamp);
  return getDateFromMoment(date);
}

export function getDateRange(dateStart: string, dateEnd: string): string[] {
  const range: string[] = [];
  const start = moment(dateStart);
  const end = moment(dateEnd);

  while (!start.isAfter(end, 'd')) {
    range.push(getDateFromMoment(start));
    start.add(1, 'd');
  }

  return range;
}

export function getTooltipFormatter(dataCategory: DataCategory) {
  if (dataCategory === DataCategory.ATTACHMENT) {
    return (val: number = 0) =>
      formatUsageWithUnits(val, DataCategory.ATTACHMENT, {useUnitScaling: true});
  }

  return (val: number = 0) => val.toLocaleString();
}
