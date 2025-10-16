import {useEffect} from 'react';

import {decodeScalar} from 'sentry/utils/queryString';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import {unsetQueryCursors} from 'sentry/views/insights/agents/utils/unsetQueryCursors';

/**
 * Automatically removes pagination cursors from the URL
 * whenever a non-empty search query is present.
 */
export function useRemoveUrlCursorsOnSearch() {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const searchQuery = decodeScalar(location.query.query, '');
    const cleanedCursors = unsetQueryCursors(location.query);

    if (!searchQuery || !Object.keys(cleanedCursors).length) {
      return;
    }

    navigate(
      {
        ...location,
        query: {
          ...location.query,
          ...cleanedCursors,
        },
      },
      {replace: true}
    );
  }, [location, navigate]);
}
