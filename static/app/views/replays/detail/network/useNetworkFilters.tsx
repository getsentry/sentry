import {useCallback, useMemo} from 'react';

import type {SelectOption} from 'sentry/components/compactSelect';
import {decodeList, decodeScalar} from 'sentry/utils/queryString';
import useFiltersInLocationQuery from 'sentry/utils/replays/hooks/useFiltersInLocationQuery';
import {getFrameMethod, getFrameStatus} from 'sentry/utils/replays/resourceFrame';
import type {SpanFrame} from 'sentry/utils/replays/types';
import {filterItems, operationName} from 'sentry/views/replays/detail/utils';

export interface NetworkSelectOption extends SelectOption<string> {
  qs: 'f_n_method' | 'f_n_status' | 'f_n_type';
}

const DEFAULT_FILTERS = {
  f_n_method: [],
  f_n_status: [],
  f_n_type: [],
} as Record<NetworkSelectOption['qs'], string[]>;

export type FilterFields = {
  f_n_method: string[];
  f_n_search: string;
  f_n_status: string[];
  f_n_type: string[];
  n_detail_row?: string;
  n_detail_tab?: string;
};

type Options = {
  networkFrames: SpanFrame[];
};

const UNKNOWN_STATUS = 'unknown';

type Return = {
  getMethodTypes: () => NetworkSelectOption[];
  getResourceTypes: () => NetworkSelectOption[];
  getStatusTypes: () => NetworkSelectOption[];
  items: SpanFrame[];
  searchTerm: string;
  selectValue: string[];
  setFilters: (val: NetworkSelectOption[]) => void;
  setSearchTerm: (searchTerm: string) => void;
};

const FILTERS = {
  method: (item: SpanFrame, method: string[]) =>
    method.length === 0 || method.includes(String(getFrameMethod(item))),
  status: (item: SpanFrame, status: string[]) =>
    status.length === 0 ||
    status.includes(String(getFrameStatus(item))) ||
    (status.includes(UNKNOWN_STATUS) && getFrameStatus(item) === undefined),

  type: (item: SpanFrame, types: string[]) =>
    types.length === 0 || types.includes(item.op),

  searchTerm: (item: SpanFrame, searchTerm: string) =>
    JSON.stringify(item.description).toLowerCase().includes(searchTerm),
};

function useNetworkFilters({networkFrames}: Options): Return {
  const {setFilter, query} = useFiltersInLocationQuery<FilterFields>();

  const method = useMemo(() => decodeList(query.f_n_method), [query.f_n_method]);
  const status = useMemo(() => decodeList(query.f_n_status), [query.f_n_status]);
  const type = useMemo(() => decodeList(query.f_n_type), [query.f_n_type]);
  const searchTerm = decodeScalar(query.f_n_search, '').toLowerCase();

  // Need to clear Network Details URL params when we filter, otherwise you can
  // get into a state where it is trying to load details for a non fetch/xhr
  // request.
  const setFilterAndClearDetails = useCallback(
    (arg: any) => {
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
        items: networkFrames,
        filterFns: FILTERS,
        filterVals: {method, status, type, searchTerm},
      }),
    [networkFrames, method, status, type, searchTerm]
  );

  const getMethodTypes = useCallback(
    () =>
      Array.from(new Set(networkFrames.map(getFrameMethod).concat('GET').concat(method)))
        .filter(Boolean)
        .sort()
        .map(
          (value): NetworkSelectOption => ({
            value,
            label: value,
            qs: 'f_n_method',
          })
        ),
    [networkFrames, method]
  );

  const getResourceTypes = useCallback(
    () =>
      Array.from(new Set(networkFrames.map(frame => frame.op).concat(type)))
        .sort((a, b) => (operationName(a) < operationName(b) ? -1 : 1))
        .map(
          (value): NetworkSelectOption => ({
            value,
            label: value.split('.')?.[1] ?? value,
            qs: 'f_n_type',
          })
        ),
    [networkFrames, type]
  );

  const getStatusTypes = useCallback(
    () =>
      Array.from(
        new Set(
          networkFrames
            .map(frame => String(getFrameStatus(frame) ?? UNKNOWN_STATUS))
            .concat(status)
            .map(String)
        )
      )
        .sort()
        .map(
          (value): NetworkSelectOption => ({
            value,
            label: value,
            qs: 'f_n_status',
          })
        ),
    [networkFrames, status]
  );

  const setSearchTerm = useCallback(
    (f_n_search: string) =>
      setFilterAndClearDetails({f_n_search: f_n_search || undefined}),
    [setFilterAndClearDetails]
  );

  const setFilters = useCallback(
    (value: NetworkSelectOption[]) => {
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
    getMethodTypes,
    getResourceTypes,
    getStatusTypes,
    items,
    searchTerm,
    selectValue: [...method, ...status, ...type],
    setFilters,
    setSearchTerm,
  };
}

export default useNetworkFilters;
