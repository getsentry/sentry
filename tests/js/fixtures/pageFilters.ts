import type {PageFilters} from 'sentry/types/core';

export function PageFiltersFixture(params: Partial<PageFilters> = {}): PageFilters {
  return {
    datetime: {
      end: null,
      period: null,
      start: null,
      utc: null,
    },
    environments: [],
    projects: [],
    ...params,
  };
}
