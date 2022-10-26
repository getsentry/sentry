import {useCallback, useEffect, useState} from 'react';
import {browserHistory} from 'react-router';

import {useLocation} from 'sentry/utils/useLocation';

type QueryState = string | string[] | null | undefined;

interface UseQuerystringStateOptions<T> {
  key: string;
  defaultState?: T;
}

export function useQuerystringState<T extends QueryState>({
  key,
  defaultState,
}: UseQuerystringStateOptions<T>) {
  const location = useLocation();
  const [state, setState] = useState<T>((location.query[key] ?? defaultState) as T);

  const createLocationDescriptor = useCallback(
    (nextState: T) => {
      return {
        ...location,
        query: {
          ...location.query,
          [key]: nextState,
        },
      };
    },
    [location, key]
  );

  const setQueryStringState = useCallback(
    (nextState: T) => {
      browserHistory.replace(createLocationDescriptor(nextState));
    },
    [createLocationDescriptor]
  );
  useEffect(() => {
    const removeListener = browserHistory.listenBefore((nextLocation, next) => {
      if (location.pathname === nextLocation.pathname) {
        setState(nextLocation.query[key] as T);
        next(nextLocation);
        return;
      }

      if (key in nextLocation.query) {
        delete nextLocation.query[key];
      }

      next(nextLocation);
    });

    return removeListener;
  }, [key, location.pathname]);

  return [state, setQueryStringState, createLocationDescriptor] as [
    T,
    typeof setQueryStringState,
    typeof createLocationDescriptor
  ];
}
