import type {PageFilters as PageFilterType} from 'sentry/types';

export function PageFilters(params: Partial<PageFilterType> = {}): PageFilterType {
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
