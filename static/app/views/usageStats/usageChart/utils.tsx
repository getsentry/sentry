import moment from 'moment';

import {DataCategory, IntervalPeriod} from 'app/types';

import {formatUsageWithUnits} from '../utils';

export function getDateFromMoment(m: moment.Moment, interval: IntervalPeriod = '1d') {
  const unit = interval.replace(/[0-9]/g, '');

  switch (unit) {
    case 'd':
      return m.startOf('h').format('MMM D');
    default:
      return m.startOf('h').format('MMM D HH:mm');
  }
}

export function getDateFromUnixTimestamp(timestamp: number) {
  const date = moment.unix(timestamp);
  return getDateFromMoment(date);
}

export function getXAxisDates(
  dateStart: string,
  dateEnd: string,
  interval: IntervalPeriod = '1d'
): string[] {
  const range: string[] = [];
  const start = moment(dateStart).startOf('h');
  const end = moment(dateEnd).startOf('h');

  const amount = Number(interval.replace(/[a-zA-Z]/g, ''));
  const unit = interval.replace(/[0-9]/g, '');

  while (!start.isAfter(end)) {
    range.push(getDateFromMoment(start, interval));
    start.add(amount as any, unit as any); // FIXME(ts): Something odd with momentjs types
  }

  return range;
}

export function getTooltipFormatter(dataCategory: DataCategory) {
  if (dataCategory === DataCategory.ATTACHMENTS) {
    return (val: number = 0) =>
      formatUsageWithUnits(val, DataCategory.ATTACHMENTS, {useUnitScaling: true});
  }

  return (val: number = 0) => val.toLocaleString();
}
