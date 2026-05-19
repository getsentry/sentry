import type {ReactNode} from 'react';
import {createContext, useCallback, useContext, useMemo} from 'react';
import {parseAsArrayOf, parseAsString, useQueryState} from 'nuqs';

import {useOurLogsPinningEnabled} from 'sentry/views/explore/logs/pinning/useOurLogsPinning';

const LOGS_PINNED_KEY = 'logsPinned';

interface LogsPinning {
  clearPinnedRows: () => void;
  pinnedRows: Set<string>;
  togglePinnedRow: (id: string) => void;
}

const LogsPinningContext = createContext<LogsPinning | undefined>(undefined);

export function LogsPinningProvider({children}: {children: ReactNode}) {
  const [pinnedRowsList, setPinnedRowsList] = useQueryState(
    LOGS_PINNED_KEY,
    parseAsArrayOf(parseAsString).withDefault([]).withOptions({history: 'replace'})
  );

  const pinnedRows = useMemo(() => new Set(pinnedRowsList), [pinnedRowsList]);

  const togglePinnedRow = useCallback(
    (id: string) => {
      setPinnedRowsList(prev =>
        prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
      );
    },
    [setPinnedRowsList]
  );

  const clearPinnedRows = useCallback(() => {
    setPinnedRowsList([]);
  }, [setPinnedRowsList]);

  const value = useMemo(
    () => ({clearPinnedRows, pinnedRows, togglePinnedRow}),
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
