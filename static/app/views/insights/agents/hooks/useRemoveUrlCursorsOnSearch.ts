import {useEffect, useEffectEvent} from 'react';

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

  const updateLocationWithoutCursors = useEffectEvent(() => {
    const cleaned = unsetQueryCursors(location.query);
    if (!Object.keys(cleaned).length) {
      return;
    }

    navigate(
      {
        ...location,
        query: {
          ...location.query,
          ...cleaned,
        },
      },
      {replace: true}
    );
  });

  useEffect(() => {
    updateLocationWithoutCursors();
  }, [location.query.query]);
}
