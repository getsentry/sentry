import type {ReactNode} from 'react';
import {createContext, useContext, useMemo, useState} from 'react';

interface AiQueryRunIdContextValue {
  runId: number | null;
  setRunId: (id: number | null) => void;
}

const AiQueryRunIdContext = createContext<AiQueryRunIdContextValue | null>(null);

export function AiQueryRunIdProvider({children}: {children: ReactNode}) {
  const [runId, setRunId] = useState<number | null>(null);
  const value = useMemo(() => ({runId, setRunId}), [runId]);
  return (
    <AiQueryRunIdContext.Provider value={value}>{children}</AiQueryRunIdContext.Provider>
  );
}

export function useAiQueryRunId() {
  const ctx = useContext(AiQueryRunIdContext);
  if (!ctx) {
    throw new Error('useAiQueryRunId must be used within an AiQueryRunIdProvider');
  }
  return ctx;
}
