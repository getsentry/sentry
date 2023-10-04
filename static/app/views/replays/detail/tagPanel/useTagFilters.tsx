import {useCallback, useMemo} from 'react';

import type {SelectOption} from 'sentry/components/compactSelect';
import {decodeList, decodeScalar} from 'sentry/utils/queryString';
import useFiltersInLocationQuery from 'sentry/utils/replays/hooks/useFiltersInLocationQuery';
// import {filterItems} from 'sentry/views/replays/detail/utils';
import type {ReplayRecord} from 'sentry/views/replays/types';

export interface TagSelectOption extends SelectOption<string> {
  qs: 'f_t_search';
}

// const DEFAULT_FILTERS = {f_t_search: []} as Record<TagSelectOption['qs'], string[]>;

export type FilterFields = {
  f_t_search: string;
};

type Options = {
  tagFrame: ReplayRecord['tags'];
};

type Return = {
  // getProjectOptions: () => TagSelectOption[];
  items: ReplayRecord['tags'];
  searchTerm: string;
  selectValue: string[];
  // setFilters: (val: TagSelectOption[]) => void;
  setSearchTerm: (searchTerm: string) => void;
};

const FILTERS = {
  searchTerm: (item: ReplayRecord['tags'], searchTerm: string) =>
    Object.values(item).some(str => str.includes(searchTerm)),
};

function filterItems<I extends Record<string, string[]>, K extends string>({
  filterFns,
  filterVals,
  items,
}: {
  filterFns: Record<K, (item: I, val: any) => boolean>;
  filterVals: Record<K, any>;
  items: I;
}): I {
  return (
    Object.entries(items).filter(item => {
      for (const key in filterFns) {
        const filter = filterFns[key];
        const val = filterVals[key];
        const records = Object.keys(item).map(
          (i): Record<string, string[]> => [i, item[i]]
        );
        if (!filter(records, val)) {
          return false;
        }
      }
      return true;
    }) || []
  );
}

function useTagFilters({tagFrame}: Options): Return {
  const {setFilter, query} = useFiltersInLocationQuery<FilterFields>();

  const project = useMemo(() => decodeList(query.f_t_search), [query.f_t_search]);
  const searchTerm = decodeScalar(query.f_t_search, '').toLowerCase();

  const items = useMemo(
    () =>
      filterItems({
        items: tagFrame,
        filterFns: FILTERS,
        filterVals: {searchTerm},
      }),
    [tagFrame, searchTerm]
  );

  // const getProjectOptions = useCallback(
  //   () =>
  //     Array.from(new Set(tags.map(crumb => crumb.project).concat(project)))
  //       .filter(Boolean)
  //       .sort()
  //       .map(
  //         (value): TagSelectOption => ({
  //           value,
  //           label: value,
  //           qs: 'f_t_search',
  //         })
  //       ),
  //   [tags, project]
  // );

  const setSearchTerm = useCallback(
    (f_t_search: string) => setFilter({f_t_search: f_t_search || undefined}),
    [setFilter]
  );

  // const setFilters = useCallback(
  //   (value: TagSelectOption[]) => {
  //     const groupedValues = value.reduce((state, selection) => {
  //       return {
  //         ...state,
  //         [selection.qs]: [...state[selection.qs], selection.value],
  //       };
  //     }, DEFAULT_FILTERS);
  //     setFilter(groupedValues);
  //   },
  //   [setFilter]
  // );

  return {
    // getProjectOptions,
    items,
    searchTerm,
    selectValue: project,
    // setFilters,
    setSearchTerm,
  };
}

export default useTagFilters;
