import {useCallback, useMemo} from 'react';

import type {
  BreadcrumbLevelType,
  BreadcrumbTypeDefault,
  Crumb,
} from 'sentry/types/breadcrumbs';
import {isBreadcrumbLogLevel, isBreadcrumbTypeDefault} from 'sentry/types/breadcrumbs';
import {decodeList, decodeScalar} from 'sentry/utils/queryString';
import useFiltersInLocationQuery from 'sentry/utils/replays/hooks/useFiltersInLocationQuery';
import {filterItems} from 'sentry/views/replays/detail/utils';

export type FilterFields = {
  f_c_logLevel: string[];
  f_c_search: string;
};

type Item = Extract<Crumb, BreadcrumbTypeDefault>;

type Options = {
  breadcrumbs: Crumb[];
};

type Return = {
  items: Item[];
  logLevel: BreadcrumbLevelType[];
  searchTerm: string;
  setLogLevel: (logLevel: string[]) => void;
  setSearchTerm: (searchTerm: string) => void;
};

const FILTERS = {
  logLevel: (item: Item, logLevel: string[]) =>
    logLevel.length === 0 || logLevel.includes(item.level),

  searchTerm: (item: Item, searchTerm: string) =>
    JSON.stringify(item.data?.arguments || item.message)
      .toLowerCase()
      .includes(searchTerm),
};

function useConsoleFilters({breadcrumbs}: Options): Return {
  const {setFilter, query} = useFiltersInLocationQuery<FilterFields>();

  const typeDefaultCrumbs = useMemo(
    () => breadcrumbs.filter(isBreadcrumbTypeDefault),
    [breadcrumbs]
  );

  const logLevel = decodeList(query.f_c_logLevel).filter(isBreadcrumbLogLevel);
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

  const setLogLevel = useCallback(
    (f_c_logLevel: string[]) => setFilter({f_c_logLevel}),
    [setFilter]
  );

  const setSearchTerm = useCallback(
    (f_c_search: string) => setFilter({f_c_search: f_c_search || undefined}),
    [setFilter]
  );

  return {
    items,
    logLevel,
    searchTerm,
    setLogLevel,
    setSearchTerm,
  };
}

export default useConsoleFilters;
