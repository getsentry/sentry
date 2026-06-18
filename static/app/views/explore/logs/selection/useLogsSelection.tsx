import {useCallback, useMemo, useState} from 'react';

import {useOurLogsSelectionEnabled} from 'sentry/views/explore/logs/selection/useOurLogsSelection';

export interface LogsSelection {
  clearSelectedRows: () => void;
  getSelectedRowIds: () => string[];
  isRowSelected: (id: string) => boolean;
  setSelectedRows: (ids: string[]) => void;
  toggleSelectedRow: (id: string) => void;
}

export function useLogsSelection(): LogsSelection | undefined {
  const logsSelectionEnabled = useOurLogsSelectionEnabled();
  const [selectedRowIds, setSelectedRowIds] = useState<Set<string>>(() => new Set());

  const getSelectedRowIds = useCallback(
    () => Array.from(selectedRowIds.values()),
    [selectedRowIds]
  );

  const isRowSelected = useCallback(
    (id: string) => selectedRowIds.has(id),
    [selectedRowIds]
  );

  const toggleSelectedRow = useCallback((id: string) => {
    setSelectedRowIds(previous => {
      const next = new Set(previous);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const setSelectedRows = useCallback((ids: string[]) => {
    setSelectedRowIds(new Set(ids));
  }, []);

  const clearSelectedRows = useCallback(() => {
    setSelectedRowIds(new Set());
  }, []);

  const value = useMemo(
    () => ({
      clearSelectedRows,
      getSelectedRowIds,
      isRowSelected,
      setSelectedRows,
      toggleSelectedRow,
    }),
    [clearSelectedRows, getSelectedRowIds, isRowSelected, setSelectedRows, toggleSelectedRow]
  );

  return logsSelectionEnabled ? value : undefined;
}
