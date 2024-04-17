import type {PageFilters} from 'sentry/types/core';

export function GlobalSelectionFixture(params: Partial<PageFilters> = {}): PageFilters {
  return {
    projects: [1],
    environments: ['production', 'staging'],
    datetime: {
      start: '2019-10-09T11:18:59',
      end: '2019-09-09T11:18:59',
      period: '',
      utc: true,
    },
    ...params,
  };
}
