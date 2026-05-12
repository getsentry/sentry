import type {ReactNode} from 'react';
import {createContext, useContext, useMemo, useState} from 'react';

interface AiQueryContextValue {
  runId: number | null;
  setRunId: (id: number | null) => void;
}

const AiQueryContext = createContext<AiQueryContextValue>({
  runId: null,
  setRunId: () => {},
});

export function AiQueryProvider({children}: {children: ReactNode}) {
  const [runId, setRunId] = useState<number | null>(null);
  const value = useMemo(() => ({runId, setRunId}), [runId]);
  return <AiQueryContext.Provider value={value}>{children}</AiQueryContext.Provider>;
}

export function useAiQueryContext() {
  return useContext(AiQueryContext);
}
