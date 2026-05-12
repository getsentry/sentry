import type {ReactNode} from 'react';
import {createContext, useContext, useMemo, useState} from 'react';

interface AiQueryContextValue {
  runId: number | null;
  setRunId: (id: number | null) => void;
}

const AiQueryContext = createContext<AiQueryContextValue | null>(null);

export function AiQueryProvider({children}: {children: ReactNode}) {
  const [runId, setRunId] = useState<number | null>(null);
  const value = useMemo(() => ({runId, setRunId}), [runId]);
  return <AiQueryContext.Provider value={value}>{children}</AiQueryContext.Provider>;
}

export function useAiQueryContext() {
  const ctx = useContext(AiQueryContext);
  if (!ctx) {
    throw new Error('useAiQueryContext must be used within an AiQueryProvider');
  }
  return ctx;
}
