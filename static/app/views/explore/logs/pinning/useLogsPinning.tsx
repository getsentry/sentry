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
import {useOurLogsPinningEnabled} from 'sentry/views/explore/logs/pinning/useOurLogsPinning';

const LOGS_PINNED_KEY = 'logsPinned';

interface LogsPinning {
  clearPinnedRows: () => void;
  pinnedRows: Set<string>;
  togglePinnedRow: (id: string) => void;
}

const LogsPinningContext = createContext<LogsPinning | undefined>(undefined);

export function LogsPinningProvider({children}: {children: ReactNode}) {
  const location = useLocation();

  const [pinnedRows, setPinnedRows] = useState<Set<string>>(() => {
    return new Set(decodeList(location.query?.[LOGS_PINNED_KEY]).filter(Boolean));
  });

  const togglePinnedRow = useCallback((id: string) => {
    setPinnedRows(previous => {
      const next = new Set(previous);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const clearPinnedRows = useCallback(() => {
    setPinnedRows(new Set());
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    params.delete(LOGS_PINNED_KEY);

    for (const id of pinnedRows) {
      params.append(LOGS_PINNED_KEY, id);
    }

    const newSearch = params.toString();
    const newUrl = newSearch
      ? `${window.location.pathname}?${newSearch}${window.location.hash}`
      : `${window.location.pathname}${window.location.hash}`;

    window.history.replaceState(window.history.state, '', newUrl);
  }, [pinnedRows]);

  const value = useMemo(
    () => ({
      clearPinnedRows,
      pinnedRows,
      togglePinnedRow,
    }),
    [clearPinnedRows, pinnedRows, togglePinnedRow]
  );

  return (
    <LogsPinningContext.Provider value={value}>{children}</LogsPinningContext.Provider>
  );
}

export function useLogsPinning() {
  const logsPinningEnabled = useOurLogsPinningEnabled();
  const context = useContext(LogsPinningContext);

  return logsPinningEnabled ? context : undefined;
}
