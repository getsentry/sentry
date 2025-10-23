import {useEffect} from 'react';
import {useEffectEvent} from '@react-aria/utils';

import {useLocation} from 'sentry/utils/useLocation';
import {useTableCursor} from 'sentry/views/insights/agents/hooks/useTableCursor';

/**
 * Automatically removes pagination tableCursor from the URL
 * whenever a new search query is set.
 */
export function useRemoveTableCursorOnSearch() {
  const location = useLocation();
  const {unsetCursor} = useTableCursor();

  const removeCursor = useEffectEvent(() => {
    unsetCursor();
  });

  useEffect(() => {
    removeCursor();
  }, [location.query.query]);
}
