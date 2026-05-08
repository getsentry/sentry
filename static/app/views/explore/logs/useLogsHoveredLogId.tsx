import type {ReactNode} from 'react';
import {createContext, useCallback, useContext, useMemo, useState} from 'react';

interface LogsHoveredLogIdContextValue {
  hoveredLogId: string | null;
  setHoveredLogId: (id: string | null) => void;
}

const LogsHoveredLogIdContext = createContext<LogsHoveredLogIdContextValue | null>(null);

export function LogsHoveredLogIdProvider({children}: {children: ReactNode}) {
  const [hoveredLogId, setHoveredLogIdState] = useState<string | null>(null);

  const setHoveredLogId = useCallback((id: string | null) => {
    setHoveredLogIdState(id);
  }, []);

  const value = useMemo(
    () => ({hoveredLogId, setHoveredLogId}),
    [hoveredLogId, setHoveredLogId]
  );

  return (
    <LogsHoveredLogIdContext.Provider value={value}>
      {children}
    </LogsHoveredLogIdContext.Provider>
  );
}

const noop = () => {};

export function useLogsHoveredLogId(): string | null {
  const ctx = useContext(LogsHoveredLogIdContext);
  return ctx?.hoveredLogId ?? null;
}

export function useSetLogsHoveredLogId(): (id: string | null) => void {
  const ctx = useContext(LogsHoveredLogIdContext);
  return ctx?.setHoveredLogId ?? noop;
}
