import type {ReactNode} from 'react';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

import {decodeList} from 'sentry/utils/queryString';
import {useLocation} from 'sentry/utils/useLocation';

const LOGS_PINNED_KEY = 'logsPinned';

interface LogsPinnedRowsContextValue {
  clearAllPins: () => void;
  pinnedRows: Set<string>;
  togglePinnedRow: (id: string) => void;
}

const LogsPinnedRowsContext = createContext<LogsPinnedRowsContextValue | null>(null);

export function LogsPinnedRowsProvider({children}: {children: ReactNode}) {
  const location = useLocation();

  const [pinnedRows, setPinnedRows] = useState<Set<string>>(() => {
    const pinned = decodeList(location.query?.[LOGS_PINNED_KEY]).filter(Boolean);
    return new Set(pinned);
  });

  const togglePinnedRow = useCallback((id: string) => {
    setPinnedRows(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const clearAllPins = useCallback(() => {
    setPinnedRows(new Set());
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (pinnedRows.size === 0) {
      params.delete(LOGS_PINNED_KEY);
    } else {
      params.delete(LOGS_PINNED_KEY);
      for (const id of pinnedRows) {
        params.append(LOGS_PINNED_KEY, id);
      }
    }
    const newSearch = params.toString();
    const newUrl = newSearch
      ? `${window.location.pathname}?${newSearch}${window.location.hash}`
      : `${window.location.pathname}${window.location.hash}`;
    window.history.replaceState(window.history.state, '', newUrl);
  }, [pinnedRows]);

  const value = useMemo(
    () => ({pinnedRows, togglePinnedRow, clearAllPins}),
    [pinnedRows, togglePinnedRow, clearAllPins]
  );

  return (
    <LogsPinnedRowsContext.Provider value={value}>
      {children}
    </LogsPinnedRowsContext.Provider>
  );
}

const EMPTY_SET = new Set<string>();
const noop = () => {};

export function useLogsPinnedRows(): Set<string> {
  const ctx = useContext(LogsPinnedRowsContext);
  return ctx?.pinnedRows ?? EMPTY_SET;
}

export function useToggleLogPinnedRow(): (id: string) => void {
  const ctx = useContext(LogsPinnedRowsContext);
  return ctx?.togglePinnedRow ?? noop;
}

export function useClearAllLogPins(): () => void {
  const ctx = useContext(LogsPinnedRowsContext);
  return ctx?.clearAllPins ?? noop;
}
