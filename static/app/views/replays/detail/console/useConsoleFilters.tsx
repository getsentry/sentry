import {useCallback, useMemo} from 'react';
import {browserHistory} from 'react-router';

import type {BreadcrumbTypeDefault, Crumb} from 'sentry/types/breadcrumbs';
import {isBreadcrumbTypeDefault} from 'sentry/types/breadcrumbs';
import {decodeList, decodeScalar} from 'sentry/utils/queryString';
import {useLocation} from 'sentry/utils/useLocation';
import {filterItems} from 'sentry/views/replays/detail/utils';

type Item = Extract<Crumb, BreadcrumbTypeDefault>;

type Options = {
  breadcrumbs: Crumb[];
};

type Return = {
  items: Item[];
  logLevel: string[];
  searchTerm: string;
  setLogLevel: (logLevel: string[]) => void;
  setSearchTerm: (searchTerm: string) => void;
};

const FILTERS = {
  logLevel: (item: Item, logLevel: string[]) =>
    logLevel.length === 0 || logLevel.includes(item.level),

  searchTerm: (item: Item, searchTerm: string) =>
    JSON.stringify(item.data).toLowerCase().includes(searchTerm),
};

function useConsoleFilters({breadcrumbs}: Options): Return {
  const {pathname, query} = useLocation();

  const typeDefaultCrumbs = useMemo(
    () => breadcrumbs.filter(isBreadcrumbTypeDefault),
    [breadcrumbs]
  );

  /* eslint-disable react-hooks/exhaustive-deps */
  const stringyLogLevel = JSON.stringify(query.consoleLogLevel);
  const logLevel = useMemo(() => decodeList(query.consoleLogLevel), [stringyLogLevel]);
  /* eslint-enable react-hooks/exhaustive-deps */
  const searchTerm = decodeScalar(query.consoleSearch, '').toLowerCase();

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
    (consoleLogLevel: string[]) => {
      browserHistory.push({pathname, query: {...query, consoleLogLevel}});
    },
    [pathname, query]
  );

  const setSearchTerm = useCallback(
    (consoleSearch: string) => {
      browserHistory.push({
        pathname,
        query: {...query, consoleSearch: consoleSearch ? consoleSearch : undefined},
      });
    },
    [pathname, query]
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
