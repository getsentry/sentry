import {useEffect} from 'react';

import {useLocation} from 'sentry/utils/useLocation';
import {useTableCursor} from 'sentry/views/insights/agents/hooks/useTableCursor';

/**
 * Automatically removes pagination tableCursor from the URL
 * whenever a new search query is set.
 */
export function useRemoveTableCursorOnSearch() {
  const location = useLocation();
  const {unsetCursor} = useTableCursor();

  useEffect(() => {
    unsetCursor();
  }, [location.query.query, unsetCursor]);
}
