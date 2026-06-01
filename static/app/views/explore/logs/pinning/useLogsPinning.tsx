import {useCallback, useMemo} from 'react';
import {parseAsArrayOf, parseAsString, useQueryState} from 'nuqs';

import {useOurLogsPinningEnabled} from 'sentry/views/explore/logs/pinning/useOurLogsPinning';

const LOGS_PINNED_KEY = 'logsPinned';

export interface LogsPinning {
  clearPinnedRows: () => void;
  getPinnedRowIds: () => string[];
  hasPinnedRow: (id: string) => boolean;
  removePinnedRow: (id: string) => void;
  togglePinnedRow: (id: string) => void;
}

export function useLogsPinning(): LogsPinning | undefined {
  const logsPinningEnabled = useOurLogsPinningEnabled();
  const [pinnedRowsList, setPinnedRowsList] = useQueryState(
    LOGS_PINNED_KEY,
    parseAsArrayOf(parseAsString).withDefault([]).withOptions({history: 'replace'})
  );

  const pinnedRows = useMemo(() => new Set(pinnedRowsList), [pinnedRowsList]);

  const getPinnedRowIds = useCallback(
    () => Array.from(pinnedRows.values()),
    [pinnedRows]
  );

  const hasPinnedRow = useCallback((id: string) => pinnedRows.has(id), [pinnedRows]);

  const togglePinnedRow = useCallback(
    (id: string) => {
      setPinnedRowsList(previous =>
        previous.includes(id)
          ? previous.filter(previousId => previousId !== id)
          : [...previous, id]
      );
    },
    [setPinnedRowsList]
  );

  const removePinnedRow = useCallback(
    (id: string) => {
      setPinnedRowsList(pinnedRowsList.filter(previousId => previousId !== id));
    },
    [pinnedRowsList, setPinnedRowsList]
  );

  const clearPinnedRows = useCallback(() => {
    setPinnedRowsList([]);
  }, [setPinnedRowsList]);

  const value = useMemo(
    () => ({
      clearPinnedRows,
      getPinnedRowIds,
      hasPinnedRow,
      removePinnedRow,
      togglePinnedRow,
    }),
    [clearPinnedRows, getPinnedRowIds, hasPinnedRow, removePinnedRow, togglePinnedRow]
  );

  return logsPinningEnabled ? value : undefined;
}
