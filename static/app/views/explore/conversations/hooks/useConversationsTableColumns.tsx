import {useCallback, useEffect, useMemo, useRef} from 'react';
import {parseAsArrayOf, parseAsString, useQueryState} from 'nuqs';

import {useLocalStorageState} from 'sentry/utils/useLocalStorageState';
import {
  type ConversationColumn,
  parseConversationColumns,
  serializeConversationColumns,
} from 'sentry/views/explore/conversations/utils/tableColumns';

const TABLE_COLUMNS_STORAGE_KEY = 'conversations:table-columns';

const urlOptions = parseAsArrayOf(parseAsString).withOptions({history: 'replace'});

export function useConversationsTableColumns() {
  const [urlColumns, setUrlColumns] = useQueryState('tableColumns', urlOptions);
  const [stored, setStored] = useLocalStorageState<string[]>(
    TABLE_COLUMNS_STORAGE_KEY,
    []
  );

  // Both URL and storage hold the same `key:width` entries; URL wins when present.
  const source = useMemo(() => urlColumns ?? stored, [urlColumns, stored]);
  const columns = useMemo(() => parseConversationColumns(source), [source]);

  // Seed the URL from storage on first load so it reflects the saved layout.
  const firstRender = useRef(true);
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      if (!urlColumns && stored.length) {
        setUrlColumns(stored);
      }
    }
  }, [urlColumns, stored, setUrlColumns]);

  // Widths ride along on each column, so removing a column drops its width from
  // both the URL and storage for free.
  const setColumns = useCallback(
    (next: ConversationColumn[]) => {
      const entries = serializeConversationColumns(next);
      setUrlColumns(entries);
      setStored(entries);
    },
    [setUrlColumns, setStored]
  );

  return {columns, setColumns};
}
