import {useCallback} from 'react';

import {decodeScalar} from 'sentry/utils/queryString';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';

const QUERY_PARAM = 'query';

/**
 * The session list's search query, held in the URL so a filtered view is
 * linkable and survives a reload.
 */
export function useSessionsSearchQuery(): [string, (query: string) => void] {
  const location = useLocation();
  const navigate = useNavigate();

  const query = decodeScalar(location.query[QUERY_PARAM], '');

  const setQuery = useCallback(
    (newQuery: string) => {
      navigate(
        {
          ...location,
          query: {...location.query, [QUERY_PARAM]: newQuery || undefined},
        },
        {replace: true}
      );
    },
    [location, navigate]
  );

  return [query, setQuery];
}
