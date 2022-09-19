import {useCallback, useMemo} from 'react';
import {browserHistory} from 'react-router';

import {decodeList, decodeScalar} from 'sentry/utils/queryString';
import {useLocation} from 'sentry/utils/useLocation';
import {NetworkSpan, UNKNOWN_STATUS} from 'sentry/views/replays/detail/network/utils';
import {filterItems} from 'sentry/views/replays/detail/utils';

type Options = {
  networkSpans: NetworkSpan[];
};

type Return = {
  items: NetworkSpan[];
  searchTerm: string;
  setSearchTerm: (searchTerm: string) => void;
  setStatus: (status: {value: string}[]) => void;
  setType: (type: {value: string}[]) => void;
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
    JSON.stringify(item.data).toLowerCase().includes(searchTerm),
};

function useNetworkFilters({networkSpans}: Options): Return {
  const {pathname, query} = useLocation();

  /* eslint-disable react-hooks/exhaustive-deps */
  const stringyStatus = JSON.stringify(query.networkStatus);
  const stringyType = JSON.stringify(query.networkType);
  const status = useMemo(() => decodeList(query.networkStatus), [stringyStatus]);
  const type = useMemo(() => decodeList(query.networkType), [stringyType]);
  /* eslint-enable react-hooks/exhaustive-deps */
  const searchTerm = decodeScalar(query.networkSearch, '').toLowerCase();

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
    (networkStatus: {value: string}[]) => {
      browserHistory.push({
        pathname,
        query: {...query, networkStatus: networkStatus.map(_ => _.value)},
      });
    },
    [pathname, query]
  );

  const setType = useCallback(
    (networkType: {value: string}[]) => {
      browserHistory.push({
        pathname,
        query: {...query, networkType: networkType.map(_ => _.value)},
      });
    },
    [pathname, query]
  );

  const setSearchTerm = useCallback(
    (networkSearch: string) => {
      browserHistory.push({
        pathname,
        query: {...query, networkSearch: networkSearch ? networkSearch : undefined},
      });
    },
    [pathname, query]
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
