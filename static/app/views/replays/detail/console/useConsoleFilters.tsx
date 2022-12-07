import {useCallback, useMemo} from 'react';

import type {
  BreadcrumbLevelType,
  BreadcrumbTypeDefault,
  Crumb,
} from 'sentry/types/breadcrumbs';
import {isBreadcrumbLogLevel, isBreadcrumbTypeDefault} from 'sentry/types/breadcrumbs';
import {defined} from 'sentry/utils';
import {decodeList, decodeScalar} from 'sentry/utils/queryString';
import useFiltersInLocationQuery from 'sentry/utils/replays/hooks/useFiltersInLocationQuery';
import {sortBySeverity} from 'sentry/views/replays/detail/console/utils';
import {filterItems} from 'sentry/views/replays/detail/utils';

const ISSUE_CATEGORY = 'issue';
type BreadcrumbType = BreadcrumbLevelType | typeof ISSUE_CATEGORY;
type Item = Extract<Crumb, BreadcrumbTypeDefault>;

export type FilterFields = {
  f_c_logLevel: string[];
  f_c_search: string;
};

type Options = {
  breadcrumbs: Crumb[];
};

type Return = {
  getLogLevels: () => {label: string; value: string}[];
  items: Item[];
  logLevel: BreadcrumbType[];
  searchTerm: string;
  setLogLevel: (logLevel: string[]) => void;
  setSearchTerm: (searchTerm: string) => void;
};

const isBreadcrumbTypeValue = (val): val is BreadcrumbType =>
  isBreadcrumbLogLevel(val) || val === ISSUE_CATEGORY;

const FILTERS = {
  logLevel: (item: Item, logLevel: string[]) => {
    return (
      logLevel.length === 0 ||
      (item.category !== ISSUE_CATEGORY && logLevel.includes(item.level)) ||
      (item.category === ISSUE_CATEGORY && logLevel.includes(ISSUE_CATEGORY))
    );
  },

  searchTerm: (item: Item, searchTerm: string) =>
    JSON.stringify(item.data?.arguments || item.message)
      .toLowerCase()
      .includes(searchTerm),
};

function optionValueToLabel(value: string) {
  return (
    {
      error: 'console error',
      issue: 'sentry error',
    }[value] || value
  );
}

function useConsoleFilters({breadcrumbs}: Options): Return {
  const {setFilter, query} = useFiltersInLocationQuery<FilterFields>();

  const typeDefaultCrumbs = useMemo(
    () => breadcrumbs.filter(isBreadcrumbTypeDefault),
    [breadcrumbs]
  );

  const logLevel = decodeList(query.f_c_logLevel).filter(isBreadcrumbTypeValue);
  const searchTerm = decodeScalar(query.f_c_search, '').toLowerCase();

  const items = useMemo(
    () =>
      filterItems({
        items: typeDefaultCrumbs,
        filterFns: FILTERS,
        filterVals: {logLevel, searchTerm},
      }),
    [typeDefaultCrumbs, logLevel, searchTerm]
  );

  const getLogLevels = useCallback(
    () =>
      Array.from(
        new Set(
          breadcrumbs
            .map(breadcrumb =>
              breadcrumb.category === ISSUE_CATEGORY ? ISSUE_CATEGORY : breadcrumb.level
            )
            .concat(logLevel)
        )
      )
        .filter(defined)
        .sort(sortBySeverity)
        .map(value => ({
          value,
          label: optionValueToLabel(value),
        })),
    [breadcrumbs, logLevel]
  );

  const setLogLevel = useCallback(
    (f_c_logLevel: string[]) => setFilter({f_c_logLevel}),
    [setFilter]
  );

  const setSearchTerm = useCallback(
    (f_c_search: string) => setFilter({f_c_search: f_c_search || undefined}),
    [setFilter]
  );

  return {
    getLogLevels,
    items,
    logLevel,
    searchTerm,
    setLogLevel,
    setSearchTerm,
  };
}

export default useConsoleFilters;
