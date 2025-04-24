import type {PageFilters, CodecovPageFilters} from 'sentry/types/core';
import type {PageFiltersState} from 'sentry/stores/pageFiltersStore';
import type {PinnedPageFilter} from 'sentry/types/core';

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

export function CodecovPageFiltersFixture(params: Partial<CodecovPageFilters> = {}): CodecovPageFilters {
  return {
    repository: null,
    ...params,
  };
}

export function GetPageFiltersStorageFixture(params = {}) {
  return {
    pinnedFilters: new Set<PinnedPageFilter>(['projects']),
    state: {
      project: [],
      environment: [],
      start: null,
      end: null,
      period: '14d',
      utc: null,
      repository: null,
    },
    ...params
  };
}

export function PageFilterStateFixture(params: Partial<PageFiltersState> = {}) {
  return {
    isReady: true,
    desyncedFilters: new Set<PinnedPageFilter>(),
    pinnedFilters: new Set<PinnedPageFilter>(),
    shouldPersist: true,
    selection: PageFiltersFixture(),
    codecovSelection: CodecovPageFiltersFixture(),
    ...params
  }
}
