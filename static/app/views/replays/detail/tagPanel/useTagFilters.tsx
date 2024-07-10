import {useCallback, useMemo} from 'react';

import {decodeScalar} from 'sentry/utils/queryString';
import useSetQueryFieldInLocation from 'sentry/utils/url/useFiltersInLocationQuery';
import useLocationQuery from 'sentry/utils/url/useLocationQuery';
import {filterItems} from 'sentry/views/replays/detail/utils';
import type {ReplayRecord} from 'sentry/views/replays/types';

export type FilterFields = {
  f_t_search: string;
};

type Options = {
  tags: ReplayRecord['tags'];
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

function useTagFilters({tags}: Options): Return {
  const setQueryParam = useSetQueryFieldInLocation<FilterFields>();

  const {f_t_search: searchTerm} = useLocationQuery({
    fields: {
      f_t_search: decodeScalar,
    },
  });

  const filteredItems = useMemo(
    () =>
      filterItems<Record<string, string[]>, string>({
        items: Object.entries(tags).map(([key, val]) => Object.fromEntries([[key, val]])),
        filterFns: FILTERS,
        filterVals: {searchTerm: searchTerm.toLowerCase()},
      }),
    [tags, searchTerm]
  );

  const setSearchTerm = useCallback(
    (f_t_search: string) => setQueryParam({f_t_search: f_t_search || undefined}),
    [setQueryParam]
  );

  // Get from type Record<string, string[]>[] to Record<string, string[]>
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
