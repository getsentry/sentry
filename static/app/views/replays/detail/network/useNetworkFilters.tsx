import {useCallback, useMemo} from 'react';

import {decodeList, decodeScalar} from 'sentry/utils/queryString';
import useFiltersInLocationQuery from 'sentry/utils/replays/hooks/useFiltersInLocationQuery';
import {UNKNOWN_STATUS} from 'sentry/views/replays/detail/network/utils';
import {filterItems} from 'sentry/views/replays/detail/utils';
import type {NetworkSpan} from 'sentry/views/replays/types';

export type FilterFields = {
  f_n_search: string;
  f_n_status: string[];
  f_n_type: string[];
};

type Options = {
  networkSpans: NetworkSpan[];
};

type Return = {
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
    types.length === 0 || types.includes(item.op.replace('resource.', '')),

  searchTerm: (item: NetworkSpan, searchTerm: string) =>
    JSON.stringify(item.description).toLowerCase().includes(searchTerm),
};

function useNetworkFilters({networkSpans}: Options): Return {
  const {setFilter, query} = useFiltersInLocationQuery<FilterFields>();

  const status = decodeList(query.f_n_status);
  const type = decodeList(query.f_n_type);
  const searchTerm = decodeScalar(query.f_n_search, '').toLowerCase();

  const items = useMemo(
    () =>
      filterItems({
        items: networkSpans,
        filterFns: FILTERS,
        filterVals: {status, type, searchTerm},
      }),
    [networkSpans, status, type, searchTerm]
  );

  const setStatus = useCallback(
    (f_n_status: string[]) => setFilter({f_n_status}),
    [setFilter]
  );

  const setType = useCallback((f_n_type: string[]) => setFilter({f_n_type}), [setFilter]);

  const setSearchTerm = useCallback(
    (f_n_search: string) => setFilter({f_n_search: f_n_search || undefined}),
    [setFilter]
  );

  return {
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
