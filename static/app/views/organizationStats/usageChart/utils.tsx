import moment from 'moment';

import {parseStatsPeriod} from 'sentry/components/organizations/pageFilters/parse';
import {DataCategoryInfo, IntervalPeriod} from 'sentry/types';
import {parsePeriodToHours} from 'sentry/utils/dates';

import {formatUsageWithUnits} from '../utils';

/**
 * Avoid changing "MMM D" format as X-axis labels on UsageChart are naively
 * truncated by date.slice(0, 6). This avoids "..." when truncating by ECharts.
 */
export const FORMAT_DATETIME_DAILY = 'MMM D';
export const FORMAT_DATETIME_HOURLY = 'MMM D LT';

/**
 * Used to generate X-axis data points and labels for UsageChart
 * Ensure that this method is idempotent and doesn't change the moment object
 * that is passed in
 *
 * Use the `useUtc` parameter to get the UTC date for the provided
 * moment instance.
 */
export function getDateFromMoment(
  m: moment.Moment,
  interval: IntervalPeriod = '1d',
  useUtc: boolean = false
) {
  const days = parsePeriodToHours(interval) / 24;
  if (days >= 1) {
    return useUtc
      ? moment.utc(m).format(FORMAT_DATETIME_DAILY)
      : m.format(FORMAT_DATETIME_DAILY);
  }

  const parsedInterval = parseStatsPeriod(interval);
  const datetime = useUtc ? moment(m).utc() : moment(m).local();

  return parsedInterval
    ? `${datetime.format(FORMAT_DATETIME_HOURLY)} - ${datetime
        .add(parsedInterval.period as any, parsedInterval.periodLength as any)
        .format('LT (Z)')}`
    : datetime.format(FORMAT_DATETIME_HOURLY);
}

export function getDateFromUnixTimestamp(timestamp: number) {
  const date = moment.unix(timestamp);
  return getDateFromMoment(date);
}

export function getXAxisDates(
  dateStart: moment.MomentInput,
  dateEnd: moment.MomentInput,
  dateUtc: boolean = false,
  interval: IntervalPeriod = '1d'
): string[] {
  const range: string[] = [];
  const start = moment(dateStart).startOf('h');
  const end = moment(dateEnd).startOf('h');

  if (!start.isValid() || !end.isValid()) {
    return range;
  }

  const {period, periodLength} = parseStatsPeriod(interval) ?? {
    period: 1,
    periodLength: 'd',
  };

  while (!start.isAfter(end)) {
    range.push(getDateFromMoment(start, interval, dateUtc));
    start.add(period as any, periodLength as any); // FIXME(ts): Something odd with momentjs types
  }

  return range;
}

export function getTooltipFormatter(dataCategory: DataCategoryInfo['plural']) {
  return (val: number = 0) =>
    formatUsageWithUnits(val, dataCategory, {useUnitScaling: true});
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
