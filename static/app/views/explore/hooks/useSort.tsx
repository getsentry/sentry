import {useCallback, useMemo} from 'react';
import type {Location} from 'history';

import {decodeScalar} from 'sentry/utils/queryString';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';

import type {Field} from './useSampleFields';

interface Options {
  fields: Field[];
}

export type Direction = 'asc' | 'desc';
export type Sort = {
  direction: Direction;
  field: Field;
};

export function useSort(props): [Sort, (newSort: Sort) => void] {
  const location = useLocation();
  const navigate = useNavigate();
  const options = {location, navigate, ...props};

  return useSortImpl(options);
}

interface ImplOptions extends Options {
  location: Location;
  navigate: ReturnType<typeof useNavigate>;
}

function useSortImpl({
  fields,
  location,
  navigate,
}: ImplOptions): [Sort, (newSort: Sort) => void] {
  const rawSort = decodeScalar(location.query.sort);

  const direction: Direction = !rawSort || rawSort.startsWith('-') ? 'desc' : 'asc';

  const field: Field = useMemo(() => {
    let f = rawSort;
    if (direction === 'desc') {
      f = f?.substring(1);
    }
    f = f || 'timestamp';
    if (fields.length && !fields.includes(f)) {
      f = fields[0];
    }
    return f;
  }, [rawSort, direction, fields]);

  const sort: Sort = useMemo(() => {
    return {
      direction,
      field,
    };
  }, [direction, field]);

  const setSort = useCallback(
    (newSort: Sort) => {
      const formatted =
        newSort.direction === 'desc' ? `-${newSort.field}` : newSort.field;
      navigate({
        ...location,
        query: {
          ...location.query,
          sort: formatted,
        },
      });
    },
    [location, navigate]
  );

  return [sort, setSort];
}
