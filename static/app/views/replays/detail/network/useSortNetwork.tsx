import {useCallback, useMemo} from 'react';
import {browserHistory} from 'react-router';

import {decodeScalar} from 'sentry/utils/queryString';
import {useLocation} from 'sentry/utils/useLocation';
import type {NetworkSpan} from 'sentry/views/replays/types';

interface SortConfig {
  asc: boolean;
  by: keyof NetworkSpan | string;
  getValue: (row: NetworkSpan) => any;
}

const SortStrategies: Record<string, (row) => any> = {
  method: row => row.data.method || 'GET',
  status: row => row.data.statusCode,
  description: row => row.description,
  op: row => row.op,
  size: row => row.data.size ?? row.data.response?.size ?? row.data.responseBodySize,
  duration: row => row.endTimestamp - row.startTimestamp,
  startTimestamp: row => row.startTimestamp,
};

const DEFAULT_ASC = 'true';
const DEFAULT_BY = 'startTimestamp';

type Opts = {items: NetworkSpan[]};

function useSortNetwork({items}: Opts) {
  const location = useLocation();

  const sortAsc = decodeScalar(location.query.s_n_asc) || DEFAULT_ASC;
  const sortBy = decodeScalar(location.query.s_n_by) || DEFAULT_BY;

  const sortConfig = useMemo(
    () =>
      ({
        asc: sortAsc === 'true',
        by: sortBy,
        getValue: SortStrategies[sortBy],
      } as SortConfig),
    [sortAsc, sortBy]
  );

  const sortedItems = useMemo(() => sortNetwork(items, sortConfig), [items, sortConfig]);

  const handleSort = useCallback(
    (fieldName: keyof typeof SortStrategies) => {
      const asc =
        sortConfig.by === fieldName ? (sortConfig.asc ? 'false' : 'true') : DEFAULT_ASC;

      browserHistory.push({
        ...location,
        query: {
          ...location.query,
          s_n_asc: asc,
          s_n_by: fieldName,
          n_detail_row: '',
        },
      });
    },
    [sortConfig, location]
  );

  return {
    handleSort,
    items: sortedItems,
    sortConfig,
  };
}

function sortNetwork(network: NetworkSpan[], sortConfig: SortConfig): NetworkSpan[] {
  return [...network].sort((a, b) => {
    let valueA = sortConfig.getValue(a);
    let valueB = sortConfig.getValue(b);

    valueA = typeof valueA === 'string' ? valueA.toUpperCase() : valueA;
    valueB = typeof valueB === 'string' ? valueB.toUpperCase() : valueB;

    // if the values are not defined, we want to push them to the bottom of the list
    if (valueA === undefined) {
      return 1;
    }

    if (valueB === undefined) {
      return -1;
    }

    if (valueA === valueB) {
      return 0;
    }

    if (sortConfig.asc) {
      return valueA > valueB ? 1 : -1;
    }

    return valueB > valueA ? 1 : -1;
  });
}

export default useSortNetwork;
