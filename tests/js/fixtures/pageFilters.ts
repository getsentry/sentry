import type {PageFiltersState} from 'sentry/stores/pageFiltersStore';
import type {PageFilters, PinnedPageFilter} from 'sentry/types/core';

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

export function PageFiltersStorageFixture(params = {}) {
  return {
    pinnedFilters: new Set<PinnedPageFilter>(['projects']),
    state: {
      project: [],
      environment: [],
      start: null,
      end: null,
      period: '14d',
      utc: null,
    },
    ...params,
  };
}

export function PageFilterStateFixture(
  params: Partial<PageFiltersState> = {}
): PageFiltersState {
  return {
    isReady: true,
    desyncedFilters: new Set<PinnedPageFilter>(),
    pinnedFilters: new Set<PinnedPageFilter>(),
    shouldPersist: true,
    selection: PageFiltersFixture(),
    ...params,
  };
}
