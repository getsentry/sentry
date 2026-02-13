import {useCallback, useMemo} from 'react';
import {parseAsBoolean, parseAsString, parseAsStringLiteral, useQueryState} from 'nuqs';

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

type Opts = {items: SpanFrame[]};

export default function useSortNetwork({items}: Opts) {
  const [sortAsc, setSortAsc] = useQueryState(
    's_n_asc',
    parseAsBoolean.withDefault(true).withOptions({history: 'push', throttleMs: 0})
  );
  const [sortBy, setSortBy] = useQueryState(
    's_n_by',
    parseAsStringLiteral(Object.keys(SortStrategies))
      .withDefault('startTimestamp')
      .withOptions({history: 'push', throttleMs: 0})
  );
  const [, setDetailRow] = useQueryState(
    'n_detail_row',
    parseAsString.withDefault('').withOptions({history: 'push', throttleMs: 0})
  );

  const sortConfig = useMemo(
    () =>
      ({
        asc: sortAsc === true,
        by: sortBy,
        getValue: SortStrategies[sortBy],
      }) as SortConfig,
    [sortAsc, sortBy]
  );

  const sortedItems = useMemo(() => sortNetwork(items, sortConfig), [items, sortConfig]);

  const handleSort = useCallback(
    (fieldName: keyof typeof SortStrategies) => {
      if (sortConfig.by === fieldName) {
        setSortAsc(sortConfig.asc ? false : true);
      } else {
        setSortAsc(true);
        setSortBy(fieldName);
      }
      setDetailRow('');
    },
    [sortConfig, setSortAsc, setSortBy, setDetailRow]
  );

  return {
    handleSort,
    items: sortedItems,
    sortConfig,
  };
}

function sortNetwork(network: SpanFrame[], sortConfig: SortConfig): SpanFrame[] {
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
