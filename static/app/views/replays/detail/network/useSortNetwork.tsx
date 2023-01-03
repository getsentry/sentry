import {useCallback, useMemo, useState} from 'react';

import type {NetworkSpan} from 'sentry/views/replays/types';

interface SortConfig {
  asc: boolean;
  by: keyof NetworkSpan | string;
  getValue: (row: NetworkSpan) => any;
}

type Opts = {items: NetworkSpan[]};

function useSortNetwork({items}: Opts) {
  const [sortConfig, setSortConfig] = useState<SortConfig>({
    by: 'startTimestamp',
    asc: true,
    getValue: row => row[sortConfig.by],
  });

  const sortedItems = useMemo(() => sortNetwork(items, sortConfig), [items, sortConfig]);

  const handleSort = useCallback(
    (
      fieldName: string | keyof NetworkSpan,
      getValue: (row: NetworkSpan) => any = (row: NetworkSpan) => row[fieldName]
    ) => {
      setSortConfig(prevSort =>
        prevSort.by === fieldName
          ? {by: fieldName, asc: !prevSort.asc, getValue}
          : {by: fieldName, asc: true, getValue}
      );
    },
    [setSortConfig]
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
