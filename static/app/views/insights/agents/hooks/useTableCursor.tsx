import {useCallback} from 'react';
import {useQueryState} from 'nuqs';

import type {CursorHandler} from 'sentry/components/pagination';
import {TableUrlParams} from 'sentry/views/insights/agents/utils/urlParams';

interface UseTableCursorResult {
  /**
   * The current cursor value from the URL query
   */
  cursor: string | undefined;
  /**
   * Handler function to update the cursor in the URL
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

  const setCursor: CursorHandler = useCallback(
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
