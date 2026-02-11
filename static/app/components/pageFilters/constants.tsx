import {DEFAULT_STATS_PERIOD} from 'sentry/constants';
import type {PageFilters} from 'sentry/types/core';

export const URL_PARAM = {
  START: 'start',
  END: 'end',
  UTC: 'utc',
  PERIOD: 'statsPeriod',
  PROJECT: 'project',
  ENVIRONMENT: 'environment',
};

export const PAGE_URL_PARAM = {
  PAGE_START: 'pageStart',
  PAGE_END: 'pageEnd',
  PAGE_UTC: 'pageUtc',
  PAGE_PERIOD: 'pageStatsPeriod',
};

const DATE_TIME = {
  START: 'start',
  END: 'end',
  PERIOD: 'period',
  UTC: 'utc',
};

export const DATE_TIME_KEYS = [...Object.values(DATE_TIME), 'statsPeriod'];

export const ALL_ACCESS_PROJECTS = -1;

/**
 * Make a default page filters selection object
 */
export function getDefaultPageFilterSelection(): PageFilters {
  return {
    projects: [],
    environments: [],
    datetime: {
      start: null,
      end: null,
      period: DEFAULT_STATS_PERIOD,
      utc: null,
    },
  };
}
