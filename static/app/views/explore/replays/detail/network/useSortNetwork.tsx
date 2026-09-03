import {useCallback, useMemo} from 'react';
import {parseAsBoolean, parseAsInteger, parseAsStringLiteral, useQueryStates} from 'nuqs';

import type {SpanFrame} from 'sentry/utils/replays/types';

interface SortConfig {
  asc: boolean;
  by: keyof SpanFrame | string;
  getValue: (row: SpanFrame) => any;
}

const SortStrategies: Record<string, (row: any) => any> = {
  method: row => row.data.method || 'GET',
  status: row => row.data.statusCode,
  description: row => row.description,
  op: row => row.op,
  size: row => row.data.size ?? row.data.response?.size ?? row.data.responseBodySize,
  duration: row => row.endTimestamp - row.startTimestamp,
  startTimestamp: row => row.startTimestamp,
};

const sortNetworkParsers = {
  s_n_asc: parseAsBoolean.withDefault(true),
  s_n_by: parseAsStringLiteral(Object.keys(SortStrategies)).withDefault('startTimestamp'),
  n_detail_row: parseAsInteger,
};

type Opts = {items: SpanFrame[]};

export function useSortNetwork({items}: Opts) {
  const [sortState, setSortState] = useQueryStates(sortNetworkParsers, {
    history: 'push',
    throttleMs: 0,
  });

  const {s_n_asc: sortAsc, s_n_by: sortBy} = sortState;

  const sortConfig = useMemo(
    () =>
      ({
        asc: sortAsc,
        by: sortBy,
        getValue: SortStrategies[sortBy],
      }) as SortConfig,
    [sortAsc, sortBy]
  );

  const sortedItems = useMemo(() => sortNetwork(items, sortConfig), [items, sortConfig]);

  const handleSort = useCallback(
    (fieldName: keyof typeof SortStrategies) => {
      if (sortConfig.by === fieldName) {
        setSortState({s_n_asc: !sortConfig.asc, n_detail_row: null});
      } else {
        setSortState({s_n_asc: true, s_n_by: fieldName, n_detail_row: null});
      }
    },
    [sortConfig, setSortState]
  );

  return {
    handleSort,
    items: sortedItems,
    sortConfig,
  };
}

function sortNetwork(network: SpanFrame[], sortConfig: SortConfig): SpanFrame[] {
  return network.toSorted((a, b) => {
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
