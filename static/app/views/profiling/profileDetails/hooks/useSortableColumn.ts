import {useCallback, useEffect, useMemo} from 'react';
import {browserHistory} from 'react-router';

import {GridColumnSortBy} from 'sentry/components/gridEditable';
import {useLocation} from 'sentry/utils/useLocation';

export function useSortableColumns<T extends string>(options: {
  defaultSort: GridColumnSortBy<T>;
  querystringKey: string;
  sortableColumns: Set<string>;
}) {
  const {sortableColumns, querystringKey, defaultSort} = options;
  const location = useLocation();
  const currentSort = useMemo<GridColumnSortBy<T>>(() => {
    let key = location.query?.[querystringKey] ?? '';

    const isDesc = key[0] === '-';
    if (isDesc) {
      key = key.slice(1);
    }

    if (!key || !sortableColumns.has(key as T)) {
      return defaultSort;
    }

    return {
      key,
      order: isDesc ? 'desc' : 'asc',
    } as GridColumnSortBy<T>;
  }, [location.query, sortableColumns, defaultSort, querystringKey]);

  useEffect(() => {
    const removeListener = browserHistory.listenBefore((nextLocation, next) => {
      if (location.pathname === nextLocation.pathname) {
        next(nextLocation);
        return;
      }

      if (querystringKey in nextLocation.query) {
        delete nextLocation.query[querystringKey];
      }

      next(nextLocation);
    });

    return removeListener;
  });

  const generateSortLink = useCallback(
    (column: T) => {
      if (!sortableColumns.has(column)) {
        return () => undefined;
      }
      if (!currentSort) {
        return () => ({
          ...location,
          query: {
            ...location.query,
            functionsSort: column,
          },
        });
      }

      const direction =
        currentSort.key !== column
          ? 'desc'
          : currentSort.order === 'desc'
          ? 'asc'
          : 'desc';

      return () => ({
        ...location,
        query: {
          ...location.query,
          functionsSort: `${direction === 'desc' ? '-' : ''}${column}`,
        },
      });
    },
    [location, currentSort, sortableColumns]
  );

  // TODO: support strings
  const sortCompareFn = (a: Record<T, number>, b: Record<T, number>) => {
    if (currentSort.order === 'asc') {
      return a[currentSort.key] - b[currentSort.key];
    }
    return b[currentSort.key] - a[currentSort.key];
  };

  return {
    currentSort,
    generateSortLink,
    sortCompareFn,
  };
}
