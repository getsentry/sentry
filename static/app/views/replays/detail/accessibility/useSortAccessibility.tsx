import {useCallback, useMemo} from 'react';

import type {SpanFrame} from 'sentry/utils/replays/types';
import useUrlParams from 'sentry/utils/useUrlParams';

interface SortConfig {
  asc: boolean;
  by: keyof SpanFrame | string;
  getValue: (row: SpanFrame) => any;
}

const IMPACT_SORT = {
  minor: 0,
  moderate: 1,
  serious: 2,
  critical: 3,
};

const SortStrategies: Record<string, (row) => any> = {
  impact: row => IMPACT_SORT[row.impact],
  id: row => row.id,
  element: row => row.element,
  startTimestamp: row => row.startTimestamp,
};

const DEFAULT_ASC = 'false';
const DEFAULT_BY = 'impact';

type Opts = {items: SpanFrame[]};

function useSortAccessibility({items}: Opts) {
  const {getParamValue: getSortAsc, setParamValue: setSortAsc} = useUrlParams(
    's_n_asc',
    DEFAULT_ASC
  );
  const {getParamValue: getSortBy, setParamValue: setSortBy} = useUrlParams(
    's_n_by',
    DEFAULT_BY
  );
  const {setParamValue: setDetailRow} = useUrlParams('n_detail_row', '');

  const sortAsc = getSortAsc();
  const sortBy = getSortBy();

  const sortConfig = useMemo(
    () =>
      ({
        asc: sortAsc === 'true',
        by: sortBy,
        getValue: SortStrategies[sortBy],
      } as SortConfig),
    [sortAsc, sortBy]
  );

  const sortedItems = useMemo(
    () => sortAccessibility(items, sortConfig),
    [items, sortConfig]
  );

  const handleSort = useCallback(
    (fieldName: keyof typeof SortStrategies) => {
      if (sortConfig.by === fieldName) {
        setSortAsc(sortConfig.asc ? 'false' : 'true');
      } else {
        setSortAsc('true');
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

function sortAccessibility(
  accessibility: SpanFrame[],
  sortConfig: SortConfig
): SpanFrame[] {
  return [...accessibility].sort((a, b) => {
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

export default useSortAccessibility;
