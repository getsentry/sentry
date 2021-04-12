import moment from 'moment';

import {parseStatsPeriod} from 'app/components/organizations/globalSelectionHeader/getParams';
import {DataCategory, IntervalPeriod} from 'app/types';
import {intervalToMilliseconds} from 'app/utils/dates';

import {formatUsageWithUnits} from '../utils';

/**
 * Avoid changing "MMM D" format as X-axis labels on UsageChart are naively
 * truncated by date.slice(0, 6). This avoids "..." when truncating by ECharts.
 */
export const FORMAT_DATETIME_HOURLY = 'MMM D LT';
export const FORMAT_DATETIME_DAILY = 'MMM D';

/**
 * Used to generate X-axis data points and labels for UsageChart
 * Ensure that the format
 */
export function getDateFromMoment(m: moment.Moment, interval: IntervalPeriod = '1d') {
  const days = intervalToMilliseconds(interval) / (1000 * 60 * 60 * 24);
  const localtime = moment(m).startOf('h').local();

  return days >= 1
    ? localtime.format(FORMAT_DATETIME_DAILY)
    : `${localtime.format(FORMAT_DATETIME_HOURLY)} - ${localtime
        .add(1, 'h')
        .format('LT')}`;
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

  const {period, periodLength} = parseStatsPeriod(interval) ?? {
    period: 1,
    periodLength: 'd',
  };

  while (!start.isAfter(end)) {
    range.push(getDateFromMoment(start, interval));
    start.add(period as any, periodLength as any); // FIXME(ts): Something odd with momentjs types
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

const MAX_NUMBER_OF_LABELS = 10;

/**
 *
 * @param dataPeriod - Quantity of hours covered by the data
 * @param numBars - Quantity of data points covered by the dataPeriod
 */
export function getXAxisLabelInterval(dataPeriod: number, numBars: number) {
  return dataPeriod > 7 * 24
    ? getLabelIntervalLongPeriod(dataPeriod, numBars)
    : getLabelIntervalShortPeriod(dataPeriod, numBars);
}

/**
 * @param dataPeriod - Quantity of hours covered by data, expected 7+ days
 */
function getLabelIntervalLongPeriod(dataPeriod: number, numBars: number) {
  const days = dataPeriod / 24;
  if (days <= 7) {
    throw new Error('This method should be used for periods > 7 days');
  }

  // Use 1 tick per day
  let numTicks = days;
  let numLabels = numTicks;

  const daysBetweenLabels = [2, 4, 7, 14];
  const daysBetweenTicks = [1, 2, 7, 7];

  for (let i = 0; i < daysBetweenLabels.length && numLabels > MAX_NUMBER_OF_LABELS; i++) {
    numLabels = numTicks / daysBetweenLabels[i];
    numTicks = days / daysBetweenTicks[i];
  }

  return {
    xAxisTickInterval: numBars / numTicks - 1,
    xAxisLabelInterval: numBars / numLabels - 1,
  };
}

/**
 * @param dataPeriod - Quantity of hours covered by data, expected <7 days
 */
function getLabelIntervalShortPeriod(dataPeriod: number, numBars: number) {
  const days = dataPeriod / 24;
  if (days > 7) {
    throw new Error('This method should be used for periods <= 7 days');
  }

  // Use 1 tick/label per day, since it's guaranteed to be 7 or less
  const numTicks = days;
  const interval = numBars / numTicks;

  return {
    xAxisTickInterval: interval - 1,
    xAxisLabelInterval: interval - 1,
  };
}
