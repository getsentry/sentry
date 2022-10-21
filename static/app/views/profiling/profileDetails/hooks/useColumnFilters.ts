import {useMemo, useState} from 'react';

import {pluckUniqueValues} from '../utils';

type ColumnFilters<T extends string | number | symbol> = {
  [key in T]: {
    onChange: (values: {value: string}[]) => void;
    values: string[];
  };
};

export function useColumnFilters<
  T extends Record<string, string>,
  K extends string | number | symbol = keyof T
>(data: T[], columns: K[]) {
  const [filters, setFilters] = useState<Partial<Record<K, string[]>>>({});

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

  const filterPredicate = (row: T) => {
    let include = true;
    for (const key in filters) {
      const filterValues = filters[key];
      if (!filterValues) {
        continue;
      }
      const rowValue = row[key];
      include = filterValues.includes(rowValue);
      if (!include) {
        return false;
      }
    }
    return include;
  };

  return {
    filters,
    columnFilters,
    filterPredicate,
  };
}
