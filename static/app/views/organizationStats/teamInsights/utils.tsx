import moment from 'moment';

import BaseChart from 'sentry/components/charts/baseChart';
import {DateTimeObject} from 'sentry/components/charts/utils';
import {normalizeDateTimeParams} from 'sentry/components/organizations/pageFilters/parse';
import type {SeriesDataUnit} from 'sentry/types/echarts';

/**
 * Buckets a week of sequential days into one data unit
 */
export function sortSeriesByDay(data: SeriesDataUnit[]): SeriesDataUnit[] {
  return data.sort((a, b) => new Date(a.name).getTime() - new Date(b.name).getTime());
}

/**
 * Convert an object with date as the key to a series
 */
export function convertDayValueObjectToSeries(
  data: Record<string, number>
): SeriesDataUnit[] {
  return Object.entries(data).map(([bucket, count]) => ({
    value: count,
    name: new Date(bucket).getTime(),
  }));
}

/**
 * Takes a sorted array of trend items and groups them by worst/better/no chagne
 */
export function groupByTrend<T extends {trend: number}>(data: T[]): T[] {
  const worseItems = data.filter(x => Math.round(x.trend) < 0);
  const betterItems = data.filter(x => Math.round(x.trend) > 0);
  const zeroItems = data.filter(x => Math.round(x.trend) === 0);
  return [...worseItems, ...betterItems, ...zeroItems];
}

export const barAxisLabel = (
  dataEntries: number
): React.ComponentProps<typeof BaseChart>['xAxis'] => {
  return {
    splitNumber: Math.max(Math.round(dataEntries / 7), 4),
    type: 'category',
    axisTick: {
      alignWithLabel: true,
    },
    axisLabel: {
      formatter: (date: string) => {
        return moment(new Date(Number(date))).format('MMM D');
      },
    },
  };
};

const INSIGHTS_DEFAULT_STATS_PERIOD = '8w';

export function dataDatetime(
  query: Parameters<typeof normalizeDateTimeParams>[0]
): DateTimeObject {
  const {
    start,
    end,
    statsPeriod,
    utc: utcString,
  } = normalizeDateTimeParams(query, {
    allowEmptyPeriod: true,
    allowAbsoluteDatetime: true,
    allowAbsolutePageDatetime: true,
  });

  if (!statsPeriod && !start && !end) {
    return {period: INSIGHTS_DEFAULT_STATS_PERIOD};
  }

  // Following getParams, statsPeriod will take priority over start/end
  if (statsPeriod) {
    return {period: statsPeriod};
  }

  const utc = utcString === 'true';
  if (start && end) {
    return utc
      ? {
          start: moment.utc(start).format(),
          end: moment.utc(end).format(),
          utc,
        }
      : {
          start: moment(start).utc().format(),
          end: moment(end).utc().format(),
          utc,
        };
  }

  return {period: INSIGHTS_DEFAULT_STATS_PERIOD};
}
