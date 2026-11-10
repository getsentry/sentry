import {useCallback, useMemo} from 'react';
import {parseAsArrayOf, parseAsString, useQueryState} from 'nuqs';

export const LOGS_PINNED_KEY = 'logsPinned';
export const logsPinnedParser = parseAsArrayOf(parseAsString);

export interface LogsPinning {
  clearPinnedRows: () => void;
  getPinnedRowIds: () => string[];
  hasPinnedRow: (id: string) => boolean;
  removePinnedRows: (ids: string[]) => void;
  togglePinnedRow: (id: string) => void;
}

export function useLogsPinning(): LogsPinning | undefined {
  const [pinnedRowsList, setPinnedRowsList] = useQueryState(
    LOGS_PINNED_KEY,
    logsPinnedParser.withDefault([]).withOptions({history: 'replace'})
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

  const removePinnedRows = useCallback(
    (ids: string[]) => {
      const idsToRemove = new Set(ids);
      setPinnedRowsList(previous =>
        previous.filter(previousId => !idsToRemove.has(previousId))
      );
    },
    [setPinnedRowsList]
  );

  const clearPinnedRows = useCallback(() => {
    setPinnedRowsList([]);
  }, [setPinnedRowsList]);

  return useMemo(
    () => ({
      clearPinnedRows,
      getPinnedRowIds,
      hasPinnedRow,
      removePinnedRows,
      togglePinnedRow,
    }),
    [clearPinnedRows, getPinnedRowIds, hasPinnedRow, removePinnedRows, togglePinnedRow]
  );
}
