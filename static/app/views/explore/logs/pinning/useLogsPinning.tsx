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
import {useNavigate} from 'sentry/utils/useNavigate';
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
  const navigate = useNavigate();

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
    navigate(
      {
        ...location,
        query: {
          ...location.query,
          [LOGS_PINNED_KEY]: Array.from(pinnedRows),
        },
      },
      {replace: true}
    );
    // location is intentionally omitted — we only want to sync pinnedRows to the URL.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigate, pinnedRows]);

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
