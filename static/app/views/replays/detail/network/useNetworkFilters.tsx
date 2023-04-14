import {useCallback, useMemo} from 'react';

import {decodeList, decodeScalar} from 'sentry/utils/queryString';
import useFiltersInLocationQuery from 'sentry/utils/replays/hooks/useFiltersInLocationQuery';
import {filterItems, operationName} from 'sentry/views/replays/detail/utils';
import type {NetworkSpan} from 'sentry/views/replays/types';

export type FilterFields = {
  f_n_search: string;
  f_n_status: string[];
  f_n_type: string[];
  n_detail_row?: string;
  n_detail_tab?: string;
};

type Options = {
  networkSpans: NetworkSpan[];
};

const UNKNOWN_STATUS = 'unknown';

type Return = {
  getResourceTypes: () => {label: string; value: string}[];
  getStatusTypes: () => {label: string; value: string}[];
  items: NetworkSpan[];
  searchTerm: string;
  setSearchTerm: (searchTerm: string) => void;
  setStatus: (status: string[]) => void;
  setType: (type: string[]) => void;
  status: string[];
  type: string[];
};

const FILTERS = {
  status: (item: NetworkSpan, status: string[]) =>
    status.length === 0 ||
    status.includes(String(item.data.statusCode)) ||
    (status.includes(UNKNOWN_STATUS) && item.data.statusCode === undefined),

  type: (item: NetworkSpan, types: string[]) =>
    types.length === 0 || types.includes(item.op),

  searchTerm: (item: NetworkSpan, searchTerm: string) =>
    JSON.stringify(item.description).toLowerCase().includes(searchTerm),
};

function useNetworkFilters({networkSpans}: Options): Return {
  const {setFilter, query} = useFiltersInLocationQuery<FilterFields>();

  const status = decodeList(query.f_n_status);
  const type = decodeList(query.f_n_type);
  const searchTerm = decodeScalar(query.f_n_search, '').toLowerCase();

  // Need to clear Network Details URL params when we filter, otherwise you can
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
        items: networkSpans,
        filterFns: FILTERS,
        filterVals: {status, type, searchTerm},
      }),
    [networkSpans, status, type, searchTerm]
  );

  const getResourceTypes = useCallback(
    () =>
      Array.from(new Set(networkSpans.map(networkSpan => networkSpan.op).concat(type)))
        .sort((a, b) => (operationName(a) < operationName(b) ? -1 : 1))
        .map(value => ({
          value,
          label: value.split('.')?.[1] ?? value,
        })),
    [networkSpans, type]
  );

  const getStatusTypes = useCallback(
    () =>
      Array.from(
        new Set(
          networkSpans
            .map(networkSpan => networkSpan.data.statusCode ?? UNKNOWN_STATUS)
            .concat(status)
            .map(String)
        )
      )
        .sort()
        .map(value => ({
          value,
          label: value,
        })),
    [networkSpans, status]
  );

  const setStatus = useCallback(
    (f_n_status: string[]) => setFilterAndClearDetails({f_n_status}),
    [setFilterAndClearDetails]
  );

  const setType = useCallback(
    (f_n_type: string[]) => setFilterAndClearDetails({f_n_type}),
    [setFilterAndClearDetails]
  );

  const setSearchTerm = useCallback(
    (f_n_search: string) =>
      setFilterAndClearDetails({f_n_search: f_n_search || undefined}),
    [setFilterAndClearDetails]
  );

  return {
    getResourceTypes,
    getStatusTypes,
    items,
    searchTerm,
    setSearchTerm,
    setStatus,
    setType,
    status,
    type,
  };
}

export default useNetworkFilters;
