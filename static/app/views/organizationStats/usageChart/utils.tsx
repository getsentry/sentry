import moment from 'moment-timezone';

import {parseStatsPeriod} from 'sentry/components/organizations/pageFilters/parse';
import type {DataCategoryInfo, IntervalPeriod} from 'sentry/types/core';
import {parsePeriodToHours} from 'sentry/utils/duration/parsePeriodToHours';

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
  useUtc = false
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
  dateUtc = false,
  interval: IntervalPeriod = '1d'
): string[] {
  const range: string[] = [];
  let startOfUnit: moment.unitOfTime.StartOf = 'h';
  if (interval <= '6h') {
    startOfUnit = 'm';
  }
  const start = moment(dateStart).startOf(startOfUnit);
  const end = moment(dateEnd).startOf(startOfUnit);

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
  return (val = 0) => formatUsageWithUnits(val, dataCategory, {useUnitScaling: true});
}

const MAX_NUMBER_OF_LABELS = 10;

/**
 * Determines which X-axis labels should be visible based on data period and intervals.
 *
 * @param dataPeriod - Quantity of hours covered by the data
 * @param intervals - Intervals to be displayed on the X-axis
 * @returns An object containing an array indicating visibility of each X-axis label
 */
export function getXAxisLabelVisibility(dataPeriod: number, intervals: string[]) {
  if (dataPeriod <= 24) {
    return {
      xAxisLabelVisibility: Array(intervals.length).fill(false),
    };
  }

  const uniqueLabels: Set<string> = new Set();
  const labelToPositionMap: Map<string, number> = new Map();
  const labelVisibility: boolean[] = new Array(intervals.length).fill(false);

  // Collect unique labels and their positions
  intervals.forEach((label, index) => {
    if (index === 0 || label.slice(0, 6) !== intervals[index - 1]!.slice(0, 6)) {
      uniqueLabels.add(label);
      labelToPositionMap.set(label, index);
    }
  });

  const totalUniqueLabels = uniqueLabels.size;

  // Determine which labels should be visible
  if (totalUniqueLabels <= MAX_NUMBER_OF_LABELS) {
    uniqueLabels.forEach(label => {
      const position = labelToPositionMap.get(label);
      if (position !== undefined) {
        labelVisibility[position] = true;
      }
    });
    return {xAxisLabelVisibility: labelVisibility};
  }

  const interval = Math.floor(totalUniqueLabels / MAX_NUMBER_OF_LABELS);

  let i = 0;
  uniqueLabels.forEach(label => {
    if (i % interval === 0) {
      const position = labelToPositionMap.get(label);
      if (position !== undefined) {
        labelVisibility[position] = true;
      }
    }
    i++;
  });

  return {xAxisLabelVisibility: labelVisibility};
}
