import type {LegendComponentOption} from 'echarts';
import {Location} from 'history';
import moment from 'moment';

import {DEFAULT_STATS_PERIOD} from 'sentry/constants';
import {EventsStats, MultiSeriesEventsStats, PageFilters} from 'sentry/types';
import {defined, escape} from 'sentry/utils';
import {parsePeriodToHours} from 'sentry/utils/dates';
import {TableDataWithTitle} from 'sentry/utils/discover/discoverQuery';
import {decodeList} from 'sentry/utils/queryString';

const DEFAULT_TRUNCATE_LENGTH = 80;

// In minutes
export const SIXTY_DAYS = 86400;
export const THIRTY_DAYS = 43200;
export const TWO_WEEKS = 20160;
export const ONE_WEEK = 10080;
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
  truncate: number | boolean | undefined
): string {
  if (!truncate) {
    return escape(value);
  }
  const truncationLength =
    truncate && typeof truncate === 'number' ? truncate : DEFAULT_TRUNCATE_LENGTH;
  const truncated =
    value.length > truncationLength ? value.substring(0, truncationLength) + '…' : value;
  return escape(truncated);
}

/**
 * Use a shorter interval if the time difference is <= 24 hours.
 */
export function useShortInterval(datetimeObj: DateTimeObject): boolean {
  const diffInMinutes = getDiffInMinutes(datetimeObj);

  return diffInMinutes <= TWENTY_FOUR_HOURS;
}

type Fidelity = 'high' | 'medium' | 'low';

export function getInterval(datetimeObj: DateTimeObject, fidelity: Fidelity = 'medium') {
  const diffInMinutes = getDiffInMinutes(datetimeObj);

  if (diffInMinutes >= SIXTY_DAYS) {
    // Greater than or equal to 60 days
    if (fidelity === 'high') {
      return '4h';
    }
    if (fidelity === 'medium') {
      return '1d';
    }
    return '2d';
  }

  if (diffInMinutes >= THIRTY_DAYS) {
    // Greater than or equal to 30 days
    if (fidelity === 'high') {
      return '1h';
    }
    if (fidelity === 'medium') {
      return '4h';
    }
    return '1d';
  }

  if (diffInMinutes >= TWO_WEEKS) {
    if (fidelity === 'high') {
      return '30m';
    }
    if (fidelity === 'medium') {
      return '1h';
    }
    return '12h';
  }

  if (diffInMinutes > TWENTY_FOUR_HOURS) {
    // Greater than 24 hours
    if (fidelity === 'high') {
      return '30m';
    }
    if (fidelity === 'medium') {
      return '1h';
    }
    return '6h';
  }

  if (diffInMinutes > ONE_HOUR) {
    // Between 1 hour and 24 hours
    if (fidelity === 'high') {
      return '5m';
    }
    if (fidelity === 'medium') {
      return '15m';
    }
    return '1h';
  }

  // Less than or equal to 1 hour
  if (fidelity === 'high') {
    return '1m';
  }
  if (fidelity === 'medium') {
    return '5m';
  }
  return '10m';
}

/**
 * Duplicate of getInterval, except that we do not support <1h granularity
 * Used by OrgStatsV2 API
 */
export function getSeriesApiInterval(datetimeObj: DateTimeObject) {
  const diffInMinutes = getDiffInMinutes(datetimeObj);

  if (diffInMinutes >= SIXTY_DAYS) {
    // Greater than or equal to 60 days
    return '1d';
  }

  if (diffInMinutes >= THIRTY_DAYS) {
    // Greater than or equal to 30 days
    return '4h';
  }

  return '1h';
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
  return unselectedSeries.reduce((selection, series) => {
    selection[series] = false;
    return selection;
  }, {});
}

export function isMultiSeriesStats(
  data: MultiSeriesEventsStats | EventsStats | null | undefined
): data is MultiSeriesEventsStats {
  return defined(data) && data.data === undefined && data.totals === undefined;
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
export const lightenHexToRgb = (colors: string[]) =>
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

  const tableResult = tableResults[0];

  const {data, meta} = tableResult;

  if (!data || !data.length || !meta) {
    return DEFAULT_GEO_DATA;
  }

  const preAggregate = Object.keys(meta).find(column => {
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
