import {useCallback, useMemo} from 'react';

import type {SelectOption} from 'sentry/components/compactSelect';
import {decodeList, decodeScalar} from 'sentry/utils/queryString';
import useFiltersInLocationQuery from 'sentry/utils/replays/hooks/useFiltersInLocationQuery';
import type {ErrorFrame} from 'sentry/utils/replays/types';
import {filterItems} from 'sentry/views/replays/detail/utils';

export interface ErrorSelectOption extends SelectOption<string> {
  qs: 'f_e_project';
}

const DEFAULT_FILTERS = {f_e_project: []} as Record<ErrorSelectOption['qs'], string[]>;

export type FilterFields = {
  f_e_project: string[];
  f_e_search: string;
};

type Options = {
  errorFrames: ErrorFrame[];
};

type Return = {
  getProjectOptions: () => ErrorSelectOption[];
  items: ErrorFrame[];
  searchTerm: string;
  selectValue: string[];
  setFilters: (val: ErrorSelectOption[]) => void;
  setSearchTerm: (searchTerm: string) => void;
};

const FILTERS = {
  project: (item: ErrorFrame, projects: string[]) =>
    projects.length === 0 || projects.includes(item.data.projectSlug),

  searchTerm: (item: ErrorFrame, searchTerm: string) =>
    [item.message, ...item.data.labels].some(str =>
      str.toLowerCase().includes(searchTerm)
    ),
};

function useErrorFilters({errorFrames}: Options): Return {
  const {setFilter, query} = useFiltersInLocationQuery<FilterFields>();

  const project = useMemo(() => decodeList(query.f_e_project), [query.f_e_project]);
  const searchTerm = decodeScalar(query.f_e_search, '').toLowerCase();

  const items = useMemo(
    () =>
      filterItems({
        items: errorFrames,
        filterFns: FILTERS,
        filterVals: {project, searchTerm},
      }),
    [errorFrames, project, searchTerm]
  );

  const getProjectOptions = useCallback(
    () =>
      Array.from(
        new Set(errorFrames.map(crumb => crumb.data.projectSlug).concat(project))
      )
        .filter(Boolean)
        .sort()
        .map(
          (value): ErrorSelectOption => ({
            value,
            label: value,
            qs: 'f_e_project',
          })
        ),
    [errorFrames, project]
  );

  const setSearchTerm = useCallback(
    (f_e_search: string) => setFilter({f_e_search: f_e_search || undefined}),
    [setFilter]
  );

  const setFilters = useCallback(
    (value: ErrorSelectOption[]) => {
      const groupedValues = value.reduce((state, selection) => {
        return {
          ...state,
          [selection.qs]: [...state[selection.qs], selection.value],
        };
      }, DEFAULT_FILTERS);
      setFilter(groupedValues);
    },
    [setFilter]
  );

  return {
    getProjectOptions,
    items,
    searchTerm,
    selectValue: project,
    setFilters,
    setSearchTerm,
  };
}

export default useErrorFilters;
