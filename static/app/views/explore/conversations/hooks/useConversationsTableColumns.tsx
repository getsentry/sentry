import {useCallback, useMemo} from 'react';
import {parseAsArrayOf, parseAsString, useQueryState} from 'nuqs';

import {
  type ConversationColumnKey,
  parseConversationColumns,
} from 'sentry/views/explore/conversations/utils/tableColumns';

/**
 * Visible table columns, persisted in the URL so the view is shareable. When
 * the URL has no columns, the defaults are used.
 */
export function useConversationsTableColumns() {
  const [urlColumns, setUrlColumns] = useQueryState(
    'tableColumns',
    parseAsArrayOf(parseAsString).withOptions({history: 'replace'})
  );

  const columns = useMemo(() => parseConversationColumns(urlColumns), [urlColumns]);

  const setColumns = useCallback(
    (next: ConversationColumnKey[]) => {
      setUrlColumns(next);
    },
    [setUrlColumns]
  );

  return {columns, setColumns};
}
