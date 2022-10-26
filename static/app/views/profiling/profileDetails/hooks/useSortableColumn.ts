import {useCallback, useMemo} from 'react';

import {GridColumnSortBy} from 'sentry/components/gridEditable';

import {useQuerystringState} from './useQuerystringState';

export function useSortableColumns<T extends string>(options: {
  defaultSort: GridColumnSortBy<T>;
  querystringKey: string;
  sortableColumns: readonly string[];
}) {
  const {sortableColumns, querystringKey, defaultSort} = options;
  const [queryStringState, _, createLocationDescriptor] = useQuerystringState({
    key: querystringKey,
  });
  const currentSort = useMemo<GridColumnSortBy<T>>(() => {
    let key = queryStringState ?? '';

    const isDesc = key[0] === '-';
    if (isDesc) {
      key = key.slice(1);
    }

    if (!key || !sortableColumns.includes(key as T)) {
      return defaultSort;
    }

    return {
      key,
      order: isDesc ? 'desc' : 'asc',
    } as GridColumnSortBy<T>;
  }, [sortableColumns, defaultSort, queryStringState]);

  const generateSortLink = useCallback(
    (column: T) => {
      if (!sortableColumns.includes(column)) {
        return () => undefined;
      }
      if (!currentSort) {
        return () => createLocationDescriptor(column);
      }

      const direction =
        currentSort.key !== column
          ? 'desc'
          : currentSort.order === 'desc'
          ? 'asc'
          : 'desc';

      return () =>
        createLocationDescriptor(`${direction === 'desc' ? '-' : ''}${column}`);
    },
    [currentSort, sortableColumns, createLocationDescriptor]
  );

  const sortCompareFn = useCallback(
    (a: Partial<Record<T, string | number>>, b: Partial<Record<T, string | number>>) => {
      const aValue = a[currentSort.key];
      const bValue = b[currentSort.key];
      if (!aValue || !bValue) {
        return 1;
      }

      if (typeof aValue === 'number' && typeof bValue === 'number') {
        if (currentSort.order === 'asc') {
          return aValue - bValue;
        }
        return bValue - aValue;
      }

      if (typeof aValue === 'string' && typeof bValue === 'string') {
        if (currentSort.order === 'asc') {
          return aValue.localeCompare(bValue);
        }
        return bValue.localeCompare(aValue);
      }
      return 1;
    },
    [currentSort]
  );

  return {
    currentSort,
    generateSortLink,
    sortCompareFn,
  };
}
