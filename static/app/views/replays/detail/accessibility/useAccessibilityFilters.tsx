import {useCallback, useMemo} from 'react';

import type {SelectOption} from 'sentry/components/compactSelect';
import {decodeList, decodeScalar} from 'sentry/utils/queryString';
import useFiltersInLocationQuery from 'sentry/utils/replays/hooks/useFiltersInLocationQuery';
import type {SpanFrame} from 'sentry/utils/replays/types';
import {filterItems, operationName} from 'sentry/views/replays/detail/utils';

export interface AccessibilitySelectOption extends SelectOption<string> {
  qs: 'f_n_type';
}

const DEFAULT_FILTERS = {
  f_n_type: [],
} as Record<AccessibilitySelectOption['qs'], string[]>;

export type FilterFields = {
  f_n_search: string;
  f_n_type: string[];
  n_detail_row?: string;
  n_detail_tab?: string;
};

type Options = {
  accessibilityFrames: SpanFrame[];
};

type Return = {
  getResourceTypes: () => AccessibilitySelectOption[];
  items: SpanFrame[];
  searchTerm: string;
  selectValue: string[];
  setFilters: (val: AccessibilitySelectOption[]) => void;
  setSearchTerm: (searchTerm: string) => void;
};

const FILTERS = {
  type: (item: SpanFrame, types: string[]) =>
    types.length === 0 || types.includes(item.op),

  searchTerm: (item: SpanFrame, searchTerm: string) =>
    JSON.stringify(item.description).toLowerCase().includes(searchTerm),
};

function useAccessibilityFilters({accessibilityFrames}: Options): Return {
  const {setFilter, query} = useFiltersInLocationQuery<FilterFields>();

  // const method = useMemo(() => decodeList(query.f_n_method), [query.f_n_method]);
  const type = useMemo(() => decodeList(query.f_n_type), [query.f_n_type]);
  const searchTerm = decodeScalar(query.f_n_search, '').toLowerCase();

  // Need to clear Accessibility Details URL params when we filter, otherwise you can
  // get into a state where it is trying to load details for a non fetch/xhr
  // request.
  const setFilterAndClearDetails = useCallback(
    arg => {
      setFilter({
        ...arg,
        n_detail_row: undefined,
        n_detail_tab: undefined,
      });
    },
    [setFilter]
  );

  const items = useMemo(
    () =>
      filterItems({
        items: accessibilityFrames,
        filterFns: FILTERS,
        filterVals: {type, searchTerm},
      }),
    [accessibilityFrames, type, searchTerm]
  );

  // const getMethodTypes = useCallback(
  //   () =>
  //     Array.from(
  //       new Set(accessibilityFrames.map(getFrameMethod).concat('GET').concat(method))
  //     )
  //       .filter(Boolean)
  //       .sort()
  //       .map(
  //         (value): AccessibilitySelectOption => ({
  //           value,
  //           label: value,
  //           qs: 'f_n_method',
  //         })
  //       ),
  //   [accessibilityFrames, method]
  // );

  const getResourceTypes = useCallback(
    () =>
      Array.from(new Set(accessibilityFrames.map(frame => frame.op).concat(type)))
        .sort((a, b) => (operationName(a) < operationName(b) ? -1 : 1))
        .map(
          (value): AccessibilitySelectOption => ({
            value,
            label: value?.split('.')?.[1] ?? value,
            qs: 'f_n_type',
          })
        ),
    [accessibilityFrames, type]
  );

  const setSearchTerm = useCallback(
    (f_n_search: string) =>
      setFilterAndClearDetails({f_n_search: f_n_search || undefined}),
    [setFilterAndClearDetails]
  );

  const setFilters = useCallback(
    (value: AccessibilitySelectOption[]) => {
      const groupedValues = value.reduce((state, selection) => {
        return {
          ...state,
          [selection.qs]: [...state[selection.qs], selection.value],
        };
      }, DEFAULT_FILTERS);
      setFilterAndClearDetails(groupedValues);
    },
    [setFilterAndClearDetails]
  );

  return {
    getResourceTypes,
    items,
    searchTerm,
    selectValue: [...type],
    setFilters,
    setSearchTerm,
  };
}

export default useAccessibilityFilters;
