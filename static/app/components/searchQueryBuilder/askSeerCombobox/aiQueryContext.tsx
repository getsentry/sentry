import type {ReactNode} from 'react';
import {createContext, useCallback, useContext, useMemo, useRef, useState} from 'react';

interface AiQueryContextValue {
  /**
   * Stable callback to get the next runId for debounced analytics.
   * If the runId has not changed since the last call to this function, return null.
   * Else return the new runId.
   */
  getRunIdForAnalytics: () => number | null;

  /**
   * Use to update the runId used for analytics (e.g. when an AI query is applied by AskSeerPollingComboBox).
   */
  setRunId: (id: number | null) => void;
}

const AiQueryContext = createContext<AiQueryContextValue>({
  getRunIdForAnalytics: () => null,
  setRunId: () => {},
});

export function AiQueryProvider({children}: {children: ReactNode}) {
  const [runId, setRunId] = useState<number | null>(null);
  const lastTrackedRunId = useRef<number | null>(null);

  const getRunIdForAnalyticsBox = useRef<() => number | null>(() => null);
  getRunIdForAnalyticsBox.current = () => {
    if (runId === lastTrackedRunId.current) {
      return null;
    }
    lastTrackedRunId.current = runId;
    return runId;
  };

  // Stable callback that dispatches to the latest closure via ref.
  const getRunIdForAnalytics = useCallback(() => getRunIdForAnalyticsBox.current(), []);

  const value = useMemo(() => ({getRunIdForAnalytics, setRunId}), [getRunIdForAnalytics]);

  return <AiQueryContext.Provider value={value}>{children}</AiQueryContext.Provider>;
}

export function useAiQueryContext() {
  return useContext(AiQueryContext);
}
