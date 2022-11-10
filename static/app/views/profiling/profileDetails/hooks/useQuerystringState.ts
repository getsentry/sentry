import {useCallback, useEffect, useState} from 'react';
import {browserHistory} from 'react-router';

import {useLocation} from 'sentry/utils/useLocation';

interface UseQuerystringStateOptions {
  key: string;
  initialState?: string | string[];
}

export function useQuerystringState<T extends string | string[] = string>({
  key,
  initialState,
}: UseQuerystringStateOptions) {
  const location = useLocation();
  const [state, setState] = useState<T | undefined>(
    (location.query[key] as T) ?? (initialState as T)
  );

  const createLocationDescriptor = useCallback(
    (nextState: T | undefined) => {
      // we can't use the result of `useLocation` here
      // if there are multiple instances of `useQuerystringState` firing at once
      // the value of location will be stale in the callback
      const currentLocation = browserHistory.getCurrentLocation();

      return {
        ...currentLocation,
        query: {
          ...currentLocation.query,
          [key]: nextState,
        },
      };
    },
    [key]
  );

  const setQueryStringState = useCallback(
    (nextState: T | undefined) => {
      browserHistory.replace(createLocationDescriptor(nextState));
      setState(nextState);
    },
    [createLocationDescriptor]
  );

  useEffect(() => {
    const removeListener = browserHistory.listenBefore(nextLocation => {
      const currentLocation = browserHistory.getCurrentLocation();

      // if the next location is a different page altogether
      // cleanup the querystring key to ensures querystring's aren't unintentionally passed around pages
      if (
        currentLocation.pathname !== nextLocation.pathname &&
        key in nextLocation.query
      ) {
        delete nextLocation.query[key];
        return;
      }
    });

    return removeListener;
  }, [key]);

  return [state, setQueryStringState, createLocationDescriptor] as [
    T | undefined,
    typeof setQueryStringState,
    typeof createLocationDescriptor
  ];
}
