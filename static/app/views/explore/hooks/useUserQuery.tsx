import {useCallback} from 'react';
import type {Location} from 'history';

import {decodeQuery} from 'sentry/utils/discover/eventView';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';

interface Options {
  location: Location;
  navigate: ReturnType<typeof useNavigate>;
}

export function useUserQuery(): [string, (newQuery: string) => void] {
  const location = useLocation();
  const navigate = useNavigate();
  const options = {location, navigate};

  return useUserQueryImpl(options);
}

function useUserQueryImpl({
  location,
  navigate,
}: Options): [string, (newQuery: string) => void] {
  const userQuery = decodeQuery(location);

  const setUserQuery = useCallback(
    (newQuery: string) => {
      navigate({
        ...location,
        query: {
          ...location.query,
          query: newQuery,
        },
      });
    },
    [location, navigate]
  );

  return [userQuery, setUserQuery];
}
