import {useCallback, useMemo} from 'react';
import {parseAsBoolean, parseAsStringLiteral, useQueryState} from 'nuqs';

import type {SortConfig} from 'sentry/components/replays/virtualizedGrid/headerCell';
import type {ErrorFrame} from 'sentry/utils/replays/types';

const SortStrategies: Record<string, (row: ErrorFrame) => any> = {
  id: row => row.data.eventId,
  level: row => row.data.level,
  title: row => row.message,
  project: row => row.data.projectSlug,
  timestamp: row => row.timestamp,
};

type Opts = {items: ErrorFrame[]};

export default function useSortErrors({items}: Opts) {
  const [sortAsc, setSortAsc] = useQueryState(
    's_e_asc',
    parseAsBoolean.withDefault(true).withOptions({history: 'push', throttleMs: 0})
  );
  const [sortBy, setSortBy] = useQueryState(
    's_e_by',
    parseAsStringLiteral(Object.keys(SortStrategies))
      .withDefault('timestamp')
      .withOptions({history: 'push', throttleMs: 0})
  );

  const sortConfig = useMemo(
    () =>
      ({
        asc: sortAsc === true,
        by: sortBy,
        getValue: SortStrategies[sortBy]!,
      }) satisfies SortConfig<ErrorFrame>,
    [sortAsc, sortBy]
  );

  const sortedItems = useMemo(() => sortErrors(items, sortConfig), [items, sortConfig]);

  const handleSort = useCallback(
    (fieldName: keyof typeof SortStrategies) => {
      if (sortConfig.by === fieldName) {
        setSortAsc(sortConfig.asc ? false : true);
      } else {
        setSortAsc(true);
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

function sortErrors(
  frames: ErrorFrame[],
  sortConfig: SortConfig<ErrorFrame>
): ErrorFrame[] {
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
