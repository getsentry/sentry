import {useCallback, useMemo} from 'react';
import type {Location} from 'history';

import type {Sort} from 'sentry/utils/discover/fields';
import {decodeSorts} from 'sentry/utils/queryString';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';

import type {Field} from './useSampleFields';

interface Options {
  fields: Field[];
}

export function useSorts(props): [Sort[], (newSorts: Sort[]) => void] {
  const location = useLocation();
  const navigate = useNavigate();
  const options = {location, navigate, ...props};

  return useSortsImpl(options);
}

interface ImplOptions extends Options {
  location: Location;
  navigate: ReturnType<typeof useNavigate>;
}

function useSortsImpl({
  fields,
  location,
  navigate,
}: ImplOptions): [Sort[], (newSorts: Sort[]) => void] {
  const sorts = useMemo(() => getSorts(fields, location), [fields, location]);

  const setSort = useCallback(
    (newSorts: Sort[]) => {
      const formatted = newSorts.map(newSort => {
        return newSort.kind === 'desc' ? `-${newSort.field}` : newSort.field;
      });
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

  return [sorts, setSort];
}

export function getSorts(fields: Field[], location: Location) {
  const rawSorts = decodeSorts(location.query.sort);

  // Try to assign a default sort if possible
  if (!rawSorts.length || !rawSorts.some(rawSort => fields.includes(rawSort.field))) {
    if (fields.includes('timestamp')) {
      return [
        {
          field: 'timestamp',
          kind: 'desc' as const,
        },
      ];
    }

    if (fields.length) {
      return [
        {
          field: fields[0],
          kind: 'desc' as const,
        },
      ];
    }

    return [];
  }

  return rawSorts;
}
