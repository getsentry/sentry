import {useCallback, useMemo} from 'react';

import type {BreadcrumbFrame, ErrorFrame} from 'sentry/utils/replays/types';
import useUrlParams from 'sentry/utils/useUrlParams';

interface SortConfig {
  asc: boolean;
  by: keyof BreadcrumbFrame | string;
  getValue: (row: BreadcrumbFrame) => any;
}

const SortStrategies: Record<string, (row: ErrorFrame) => any> = {
  id: row => row.data.eventId,
  title: row => row.message,
  project: row => row.data.projectSlug,
  timestamp: row => row.timestamp,
};

const DEFAULT_ASC = 'true';
const DEFAULT_BY = 'timestamp';

type Opts = {items: ErrorFrame[]};

function useSortErrors({items}: Opts) {
  const {getParamValue: getSortAsc, setParamValue: setSortAsc} = useUrlParams(
    's_e_asc',
    DEFAULT_ASC
  );
  const {getParamValue: getSortBy, setParamValue: setSortBy} = useUrlParams(
    's_e_by',
    DEFAULT_BY
  );

  const sortAsc = getSortAsc();
  const sortBy = getSortBy();

  const sortConfig = useMemo(
    () =>
      ({
        asc: sortAsc === 'true',
        by: sortBy,
        getValue: SortStrategies[sortBy],
      }) as SortConfig,
    [sortAsc, sortBy]
  );

  const sortedItems = useMemo(() => sortErrors(items, sortConfig), [items, sortConfig]);

  const handleSort = useCallback(
    (fieldName: keyof typeof SortStrategies) => {
      if (sortConfig.by === fieldName) {
        setSortAsc(sortConfig.asc ? 'false' : 'true');
      } else {
        setSortAsc('true');
        setSortBy(fieldName);
      }
    },
    [sortConfig, setSortAsc, setSortBy]
  );

  return {
    handleSort,
    items: sortedItems,
    sortConfig,
  };
}

function sortErrors(frames: ErrorFrame[], sortConfig: SortConfig): ErrorFrame[] {
  return [...frames].sort((a, b) => {
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

export default useSortErrors;
