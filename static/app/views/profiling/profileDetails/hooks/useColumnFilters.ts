import {useCallback, useEffect, useMemo, useRef, useState} from 'react';

import {pluckUniqueValues} from '../utils';

type ColumnFilters<T extends string | number | symbol> = {
  [key in T]: {
    onChange: (values: {value: string}[]) => void;
    values: string[];
  };
};

interface ColumnFiltersOptions<K extends string> {
  columns: K[];
  initialState?: Record<K, string[] | string | undefined>;
}

function parseInitialState(state?: Record<string, string[] | string | undefined>) {
  if (!state) {
    return {};
  }
  return Object.entries(state).reduce((acc, [key, val]) => {
    acc[key] = undefined;

    if (Array.isArray(val)) {
      acc[key] = val;
    }

    if (typeof val === 'string') {
      acc[key] = [val];
    }

    return acc;
  }, {});
}

export function useColumnFilters<
  T extends Record<string, string | number | undefined | any[]>,
  K extends string = Extract<keyof T, string>
>(data: T[], options: ColumnFiltersOptions<K>) {
  const {columns} = options;
  const [filters, setFilters] = useState<Partial<Record<K, string[]>>>(
    parseInitialState(options.initialState)
  );

  const columnFilters = useMemo(() => {
    function makeOnFilterChange(key: string) {
      return (values: {value: string}[]) => {
        setFilters(prevFilters => ({
          ...prevFilters,
          [key]: values.length > 0 ? values.map(val => val.value) : undefined,
        }));
      };
    }

    return columns.reduce((acc, key) => {
      acc[key] = {
        values: pluckUniqueValues(data, key as string).sort((a, b) => a.localeCompare(b)),
        onChange: makeOnFilterChange(key as string),
      };
      return acc;
    }, {} as ColumnFilters<K>);
  }, [data, columns]);

  // we need to validate that the initial state contain valid values
  // if they do not we need to filter those out and update filters
  // we only want this to run once
  const didRun = useRef(false);
  useEffect(() => {
    if (didRun.current || data.length === 0) {
      return;
    }

    setFilters(currentFilters => {
      return Object.entries(currentFilters).reduce((acc, entry) => {
        const [filterKey, filterValues] = entry as [string, any[] | undefined];
        const possibleValues = columnFilters[filterKey].values;
        const validValues = filterValues?.filter(v => possibleValues.includes(v));
        acc[filterKey] =
          Array.isArray(validValues) && validValues.length > 0 ? validValues : undefined;
        return acc;
      }, {});
    });
    didRun.current = true;
  }, [data.length, columnFilters, filters]);

  const filterPredicate = useCallback(
    (row: Partial<T>) => {
      let include = true;
      for (const key in filters) {
        const filterValues = filters[key];
        if (!filterValues) {
          continue;
        }
        const rowValue = row[key];
        include = filterValues.includes(rowValue as string);
        if (!include) {
          return false;
        }
      }
      return include;
    },
    [filters]
  );

  return {
    filters,
    columnFilters,
    filterPredicate,
  };
}
