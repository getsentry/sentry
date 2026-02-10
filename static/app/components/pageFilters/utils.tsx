import {DEFAULT_STATS_PERIOD} from 'sentry/constants';
import type {PageFilters} from 'sentry/types/core';

/**
 * Make a default page filters object
 */
export function getDefaultSelection(): PageFilters {
  const datetime = {
    start: null,
    end: null,
    period: DEFAULT_STATS_PERIOD,
    utc: null,
  };

  return {
    projects: [],
    environments: [],
    datetime,
  };
}
