import {useMemo} from 'react';
import * as Sentry from '@sentry/react';
import type {LegendComponentOption} from 'echarts';
import type {Location} from 'history';
import orderBy from 'lodash/orderBy';
import moment from 'moment-timezone';

import {DEFAULT_STATS_PERIOD} from 'sentry/constants';
import type {PageFilters} from 'sentry/types/core';
import type {ReactEchartsRef, Series} from 'sentry/types/echarts';
import type {
  EventsStats,
  GroupedMultiSeriesEventsStats,
  MultiSeriesEventsStats,
} from 'sentry/types/organization';
import {defined, escape} from 'sentry/utils';
import {getFormattedDate} from 'sentry/utils/dates';
import type {TableDataWithTitle} from 'sentry/utils/discover/discoverQuery';
import {parsePeriodToHours} from 'sentry/utils/duration/parsePeriodToHours';
import oxfordizeArray from 'sentry/utils/oxfordizeArray';
import {decodeList} from 'sentry/utils/queryString';

const DEFAULT_TRUNCATE_LENGTH = 80;

const {error} = Sentry._experiment_log;

// In minutes
export const SIXTY_DAYS = 86400;
export const THIRTY_DAYS = 43200;
export const TWO_WEEKS = 20160;
export const ONE_WEEK = 10080;
export const FORTY_EIGHT_HOURS = 2880;
export const TWENTY_FOUR_HOURS = 1440;
export const SIX_HOURS = 360;
export const ONE_HOUR = 60;

/**
 * If there are more releases than this number we hide "Releases" series by default
 */
export const RELEASE_LINES_THRESHOLD = 50;

export type DateTimeObject = Partial<PageFilters['datetime']>;

export function truncationFormatter(
  value: string,
  truncate: number | boolean | undefined,
  escaped = true
): string {
  // Whitespace characters such as newlines and tabs can
  // mess up the formatting in legends where it's part of
  // the formatting as it's handled by ECharts.
  //
  // In places like tooltips, it's already ignored and
  // rendered as a single space.
  //
  // So remove whitespace characters such as newlines,
  // tabs in favor of a space.
  value = value.replace(/\s+/g, ' ');

  if (truncate) {
    const truncationLength =
      truncate && typeof truncate === 'number' ? truncate : DEFAULT_TRUNCATE_LENGTH;
    value =
      value.length > truncationLength
        ? value.substring(0, truncationLength) + '…'
        : value;
  }

  if (escaped) {
    value = escape(value);
  }

  return value;
}

/**
 * Use a shorter interval if the time difference is <= 24 hours.
 */
export function computeShortInterval(datetimeObj: DateTimeObject): boolean {
  const diffInMinutes = getDiffInMinutes(datetimeObj);
  return diffInMinutes <= TWENTY_FOUR_HOURS;
}
export function useShortInterval(datetimeObj: DateTimeObject): boolean {
  return computeShortInterval(datetimeObj);
}

export type GranularityStep = [timeDiff: number, interval: string];

export class GranularityLadder {
  steps: GranularityStep[];

  constructor(steps: GranularityStep[]) {
    if (
      !steps.some(step => {
        return step[0] === 0;
      })
    ) {
      throw new Error('At least one step in the ladder must start at 0');
    }

    this.steps = orderBy(steps, step => step[0], 'desc');
  }

  getInterval(minutes: number): string {
    if (minutes < 0) {
      // Sometimes this happens, in unknown circumstances. See the `getIntervalForMetricFunction` function span in Sentry for more info, the reason might appear there. For now, a reasonable fallback in these rare cases is to return the finest granularity, since it'll either fulfill the request or time out.
      // eslint-disable-next-line @typescript-eslint/no-unused-expressions
      error`Invalid duration supplied to interval function. (minutes: ${minutes})`;

      return (this.steps.at(-1) as GranularityStep)[1];
    }

    const step = this.steps.find(([threshold]) => {
      return minutes >= threshold;
    }) as GranularityStep;

    return step[1];
  }
}

export type Fidelity =
  | 'high'
  | 'medium'
  | 'low'
  | 'metrics'
  | 'issues'
  | 'spans'
  | 'spans-low';

export function getInterval(datetimeObj: DateTimeObject, fidelity: Fidelity = 'medium') {
  const diffInMinutes = getDiffInMinutes(datetimeObj);

  return {
    high: highFidelityLadder,
    medium: mediumFidelityLadder,
    low: lowFidelityLadder,
    metrics: metricsFidelityLadder,
    issues: issuesFidelityLadder,
    spans: spansFidelityLadder,
    'spans-low': spansLowFidelityLadder,
  }[fidelity].getInterval(diffInMinutes);
}

const highFidelityLadder = new GranularityLadder([
  [SIXTY_DAYS, '4h'],
  [THIRTY_DAYS, '1h'],
  [TWENTY_FOUR_HOURS + 1, '30m'],
  [ONE_HOUR + 1, '5m'],
  [0, '1m'],
]);

const mediumFidelityLadder = new GranularityLadder([
  [SIXTY_DAYS, '1d'],
  [THIRTY_DAYS, '4h'],
  [TWENTY_FOUR_HOURS + 1, '1h'],
  [ONE_HOUR + 1, '15m'],
  [0, '5m'],
]);

const lowFidelityLadder = new GranularityLadder([
  [SIXTY_DAYS, '2d'],
  [THIRTY_DAYS, '1d'],
  [TWO_WEEKS, '12h'],
  [TWENTY_FOUR_HOURS + 1, '6h'],
  [ONE_HOUR + 1, '1h'],
  [0, '10m'],
]);

const metricsFidelityLadder = new GranularityLadder([
  [SIXTY_DAYS, '1d'],
  [THIRTY_DAYS, '12h'],
  [TWO_WEEKS, '4h'],
  [TWENTY_FOUR_HOURS, '30m'],
  [SIX_HOURS, '5m'],
  [ONE_HOUR, '1m'],
  [0, '1m'],
]);

const issuesFidelityLadder = new GranularityLadder([
  [SIXTY_DAYS, '1d'],
  [THIRTY_DAYS, '12h'],
  [TWO_WEEKS, '4h'],
  [ONE_WEEK, '2h'],
  [FORTY_EIGHT_HOURS, '1h'],
  [TWENTY_FOUR_HOURS, '20m'],
  [SIX_HOURS, '5m'],
  [ONE_HOUR, '1m'],
  [0, '1m'],
]);

const spansFidelityLadder = new GranularityLadder([
  [SIXTY_DAYS, '1d'],
  [THIRTY_DAYS, '12h'],
  [TWO_WEEKS, '4h'],
  [ONE_WEEK, '2h'],
  [FORTY_EIGHT_HOURS, '30m'],
  [TWENTY_FOUR_HOURS, '15m'],
  [SIX_HOURS, '15m'],
  [ONE_HOUR, '5m'],
  [0, '1m'],
]);

const spansLowFidelityLadder = new GranularityLadder([
  [THIRTY_DAYS, '1d'],
  [TWO_WEEKS, '12h'],
  [ONE_WEEK, '4h'],
  [FORTY_EIGHT_HOURS, '2h'],
  [TWENTY_FOUR_HOURS, '1h'],
  [SIX_HOURS, '30m'],
  [ONE_HOUR, '10m'],
  [0, '5m'],
]);

/**
 * Duplicate of getInterval, except that we do not support <1h granularity
 * Used by OrgStatsV2 API
 */
const seriesAPILadder = new GranularityLadder([
  [SIXTY_DAYS, '1d'],
  [THIRTY_DAYS, '4h'],
  [SIX_HOURS, '1h'],
  [0, '5m'],
]);
export function getSeriesApiInterval(datetimeObj: DateTimeObject) {
  return seriesAPILadder.getInterval(getDiffInMinutes(datetimeObj));
}

export function getDiffInMinutes(datetimeObj: DateTimeObject): number {
  const {period, start, end} = datetimeObj;

  if (start && end) {
    return moment(end).diff(start, 'minutes');
  }

  return (
    parsePeriodToHours(typeof period === 'string' ? period : DEFAULT_STATS_PERIOD) * 60
  );
}

// Max period (in hours) before we can no long include previous period
const MAX_PERIOD_HOURS_INCLUDE_PREVIOUS = 45 * 24;

export function canIncludePreviousPeriod(
  includePrevious: boolean | undefined,
  period: string | null | undefined
) {
  if (!includePrevious) {
    return false;
  }

  if (period && parsePeriodToHours(period) > MAX_PERIOD_HOURS_INCLUDE_PREVIOUS) {
    return false;
  }

  // otherwise true
  return !!includePrevious;
}

export function shouldFetchPreviousPeriod({
  includePrevious = true,
  period,
  start,
  end,
}: {
  includePrevious?: boolean;
} & Pick<DateTimeObject, 'start' | 'end' | 'period'>) {
  return !start && !end && canIncludePreviousPeriod(includePrevious, period);
}

/**
 * Generates a series selection based on the query parameters defined by the location.
 */
export function getSeriesSelection(
  location: Location
): LegendComponentOption['selected'] {
  const unselectedSeries = decodeList(location?.query.unselectedSeries);
  return unselectedSeries.reduce(
    (selection, series) => {
      selection[series] = false;
      return selection;
    },
    {} as Record<string, boolean>
  );
}

/**
 * @deprecated Prefer `isEventsStats`
 */
function isSingleSeriesStats(
  data: MultiSeriesEventsStats | EventsStats | GroupedMultiSeriesEventsStats
): data is EventsStats {
  return (
    (defined(data.data) || defined(data.totals)) &&
    defined(data.start) &&
    defined(data.end)
  );
}

/**
 * @deprecated Prefer `isMultiSeriesEventsStats`
 */
export function isMultiSeriesStats(
  data:
    | MultiSeriesEventsStats
    | EventsStats
    | GroupedMultiSeriesEventsStats
    | null
    | undefined,
  isTopN?: boolean
): data is MultiSeriesEventsStats {
  return (
    defined(data) &&
    ((data.data === undefined && data.totals === undefined) ||
      (defined(isTopN) && isTopN && defined(data) && !isSingleSeriesStats(data))) // the isSingleSeriesStats check is for topN queries returning null data
  );
}

// If dimension is a number convert it to pixels, otherwise use dimension
// without transform
export const getDimensionValue = (dimension?: number | string | null) => {
  if (typeof dimension === 'number') {
    return `${dimension}px`;
  }

  if (dimension === null) {
    return undefined;
  }

  return dimension;
};

const RGB_LIGHTEN_VALUE = 30;
export const lightenHexToRgb = (colors: readonly string[]) =>
  colors.map(hex => {
    const rgb = [
      Math.min(parseInt(hex.slice(1, 3), 16) + RGB_LIGHTEN_VALUE, 255),
      Math.min(parseInt(hex.slice(3, 5), 16) + RGB_LIGHTEN_VALUE, 255),
      Math.min(parseInt(hex.slice(5, 7), 16) + RGB_LIGHTEN_VALUE, 255),
    ];
    return `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`;
  });

const DEFAULT_GEO_DATA = {
  title: '',
  data: [],
};
export const processTableResults = (tableResults?: TableDataWithTitle[]) => {
  if (!tableResults || !tableResults.length) {
    return DEFAULT_GEO_DATA;
  }

  const tableResult = tableResults[0]!;

  const {data} = tableResult;

  if (!data || !data.length) {
    return DEFAULT_GEO_DATA;
  }

  const preAggregate = Object.keys(data[0]!).find(column => {
    return column !== 'geo.country_code';
  });

  if (!preAggregate) {
    return DEFAULT_GEO_DATA;
  }

  return {
    title: tableResult.title ?? '',
    data: data.map(row => {
      return {
        name: row['geo.country_code'] as string,
        value: row[preAggregate] as number,
      };
    }),
  };
};

export const getPreviousSeriesName = (seriesName: string) => {
  return `previous ${seriesName}`;
};

function formatList(items: Array<string | number | undefined>) {
  const filteredItems = items.filter((item): item is string | number => !!item);

  return oxfordizeArray(filteredItems.map(item => item.toString()));
}

export function computeEchartsAriaLabels(
  {series, useUTC}: {series: unknown; useUTC: boolean | undefined},
  isGroupedByDate: boolean
) {
  const filteredSeries = Array.isArray(series)
    ? series.filter(s => s && !!s.data && s.data.length > 0)
    : [series];

  const dateFormat = computeShortInterval({
    start: filteredSeries[0]?.data?.[0][0],
    end: filteredSeries[0]?.data?.slice(-1)[0][0],
  })
    ? `MMMM D, h:mm A`
    : 'MMMM Do';

  function formatDate(date: any) {
    return getFormattedDate(date, dateFormat, {
      local: !useUTC,
    });
  }

  // Generate title (first sentence)
  const chartTypes = new Set(filteredSeries.map(s => s.type));
  const title =
    filteredSeries.length > 0
      ? [
          `${formatList([...chartTypes])} chart`,
          isGroupedByDate
            ? `with ${formatDate(filteredSeries[0].data?.[0][0])} to ${formatDate(
                filteredSeries[0].data?.slice(-1)[0][0]
              )}`
            : '',
          `featuring ${filteredSeries.length} data series: ${formatList(
            filteredSeries.filter(s => s.data && s.data.length > 0).map(s => s.name)
          )}`,
        ].join(' ')
      : '';

  // Generate series descriptions
  const seriesDescriptions = filteredSeries
    .map(s => {
      if (!s.data || s.data.length === 0) {
        return '';
      }

      let highestValue: [number, number] = [0, -Infinity];
      let lowestValue: [number, number] = [0, Infinity];

      s.data.forEach((datum: any) => {
        if (!Array.isArray(datum)) {
          return;
        }

        if (datum[1] > highestValue[1]) {
          highestValue = datum as [number, number];
        }
        if (datum[1] < lowestValue[1]) {
          lowestValue = datum as [number, number];
        }
      });

      const lowestX = isGroupedByDate ? formatDate(lowestValue[0]) : lowestValue[0];
      const highestX = isGroupedByDate ? formatDate(lowestValue[0]) : lowestValue[0];

      const lowestY =
        typeof lowestValue[1] === 'number' ? +lowestValue[1].toFixed(3) : lowestValue[1];
      const highestY =
        typeof highestValue[1] === 'number'
          ? +highestValue[1].toFixed(3)
          : lowestValue[1];

      return `The ${s.name} series contains ${
        s.data?.length
      } data points. Its lowest value is ${lowestY} ${
        isGroupedByDate ? 'on' : 'at'
      } ${lowestX} and highest value is ${highestY} ${
        isGroupedByDate ? 'on' : 'at'
      } ${highestX}`;
    })
    .filter(s => !!s);

  if (!filteredSeries[0]) {
    return {enabled: false};
  }

  return {
    enabled: true,
    label: {description: [title].concat(seriesDescriptions).join('. ')},
  };
}

export function useEchartsAriaLabels(
  {series, useUTC}: {series: unknown; useUTC: boolean | undefined},
  isGroupedByDate: boolean
) {
  return useMemo(() => {
    return computeEchartsAriaLabels({series, useUTC}, isGroupedByDate);
  }, [series, useUTC, isGroupedByDate]);
}

export function isEmptySeries(series: Series) {
  return series.data.every(dataPoint => dataPoint.value === 0);
}

/**
 * Used to determine which chart in a group is currently hovered.
 */
export function isChartHovered(chartRef: ReactEchartsRef | null) {
  const hoveredEchartElement = document.querySelector('.echarts-for-react:hover');
  return hoveredEchartElement === chartRef?.ele;
}
