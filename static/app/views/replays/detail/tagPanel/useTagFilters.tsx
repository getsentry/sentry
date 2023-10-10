import {useCallback, useMemo} from 'react';

import {decodeScalar} from 'sentry/utils/queryString';
import useFiltersInLocationQuery from 'sentry/utils/replays/hooks/useFiltersInLocationQuery';
import {filterItems} from 'sentry/views/replays/detail/utils';
import type {ReplayRecord} from 'sentry/views/replays/types';

export type FilterFields = {
  f_t_search: string;
};

type Options = {
  tagFrame: ReplayRecord['tags'];
};

type Return = {
  items: ReplayRecord['tags'];
  searchTerm: string;
  setSearchTerm: (searchTerm: string) => void;
};

const FILTERS = {
  searchTerm: (item: ReplayRecord['tags'], searchTerm: string) =>
    Object.entries(item).some(str =>
      JSON.stringify(str).toLowerCase().includes(searchTerm)
    ),
};

function useTagFilters({tagFrame}: Options): Return {
  const {setFilter, query} = useFiltersInLocationQuery<FilterFields>();

  const searchTerm = decodeScalar(query.f_t_search, '').toLowerCase();

  const filteredItems = useMemo(
    () =>
      filterItems<Record<string, string[]>, string>({
        items: Object.entries(tagFrame).map(([key, val]) =>
          Object.fromEntries([[key, val]])
        ),
        filterFns: FILTERS,
        filterVals: {searchTerm},
      }),
    [tagFrame, searchTerm]
  );

  const setSearchTerm = useCallback(
    (f_t_search: string) => setFilter({f_t_search: f_t_search || undefined}),
    [setFilter]
  );

  const items = {};
  Object.values(filteredItems).forEach(item => {
    for (const key in item) {
      items[key] = item[key];
    }
  });

  return {
    items,
    searchTerm,
    setSearchTerm,
  };
}

export default useTagFilters;
