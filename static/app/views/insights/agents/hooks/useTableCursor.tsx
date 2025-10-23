import {useCallback} from 'react';

import type {CursorHandler} from 'sentry/components/pagination';
import {decodeScalar} from 'sentry/utils/queryString';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
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
  const navigate = useNavigate();
  const location = useLocation();

  const cursor = decodeScalar(location.query?.[TableUrlParams.CURSOR]);

  const setCursor: CursorHandler = useCallback(
    (newCursor, pathname, previousQuery) => {
      navigate(
        {
          pathname,
          query: {
            ...previousQuery,
            [TableUrlParams.CURSOR]: newCursor,
          },
        },
        {replace: true, preventScrollReset: true}
      );
    },
    [navigate]
  );

  const unsetCursor = useCallback(() => {
    navigate(
      {
        ...location,
        query: {
          ...location.query,
          [TableUrlParams.CURSOR]: undefined,
        },
      },
      {replace: true, preventScrollReset: true}
    );
  }, [navigate, location]);

  return {cursor, setCursor, unsetCursor};
}
