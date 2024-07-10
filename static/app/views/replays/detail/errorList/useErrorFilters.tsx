import {useCallback, useMemo} from 'react';

import type {SelectOption} from 'sentry/components/compactSelect';
import {decodeList, decodeScalar} from 'sentry/utils/queryString';
import type {ErrorFrame} from 'sentry/utils/replays/types';
import useSetQueryFieldInLocation from 'sentry/utils/url/useFiltersInLocationQuery';
import useLocationQuery from 'sentry/utils/url/useLocationQuery';
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
  const setQueryParam = useSetQueryFieldInLocation<FilterFields>();

  const {f_e_project: project, f_e_search: searchTerm} = useLocationQuery({
    fields: {
      f_e_project: decodeList,
      f_e_search: decodeScalar,
    },
  });

  const items = useMemo(
    () =>
      filterItems({
        items: errorFrames,
        filterFns: FILTERS,
        filterVals: {project, searchTerm: searchTerm.toLowerCase()},
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
    (f_e_search: string) => setQueryParam({f_e_search: f_e_search || undefined}),
    [setQueryParam]
  );

  const setFilters = useCallback(
    (value: ErrorSelectOption[]) => {
      const groupedValues = value.reduce((state, selection) => {
        return {
          ...state,
          [selection.qs]: [...state[selection.qs], selection.value],
        };
      }, DEFAULT_FILTERS);
      setQueryParam(groupedValues);
    },
    [setQueryParam]
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
