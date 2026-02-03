import {useCallback} from 'react';
import {useQueryState} from 'nuqs';

import type {CursorHandler} from 'sentry/components/pagination';
import {TableUrlParams} from 'sentry/views/insights/pages/agents/utils/urlParams';

interface UseTableCursorResult {
  /**
   * The current cursor value from the URL query
   */
  cursor: string | undefined;
  /**
   * Handler function compatible with Pagination's onCursor prop.
   * Only uses the cursor parameter, ignoring path, query, and delta.
   */
  setCursor: CursorHandler;
  /**
   * Function to remove the cursor from the URL
   */
  unsetCursor: () => void;
}

export function useTableCursor(): UseTableCursorResult {
  const [cursor, setCursorState] = useQueryState(TableUrlParams.CURSOR, {
    history: 'replace',
  });

  const setCursor = useCallback<CursorHandler>(
    newCursor => {
      setCursorState(newCursor ?? null);
    },
    [setCursorState]
  );

  const unsetCursor = useCallback(() => {
    setCursorState(null);
  }, [setCursorState]);

  return {cursor: cursor ?? undefined, setCursor, unsetCursor};
}
