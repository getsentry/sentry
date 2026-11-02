import type {ReactNode} from 'react';
import {createContext, useCallback, useContext, useMemo, useRef, useState} from 'react';

import type {AskSeerStrategy} from 'sentry/components/searchQueryBuilder/askSeerCombobox/types';

interface AiQueryContextValue {
  /**
   * Stable callback to get the next runId for debounced analytics.
   * If the runId has not changed since the last call to this function, return null.
   * Else return the new runId.
   */
  getRunIdForAnalytics: () => number | string | null;

  /**
   * Use to update the runId used for analytics (e.g. when an AI query is applied by AskSeerPollingComboBox).
   */
  setRunId: (id: number | string | null) => void;

  /**
   * Dataset the surface queries. Lets shared Ask Seer UI hide anything the
   * surface can't apply (e.g. the Fields chip on Issues/Metrics, which have no
   * column selection).
   */
  strategy?: AskSeerStrategy;
}

const AiQueryContext = createContext<AiQueryContextValue>({
  getRunIdForAnalytics: () => null,
  setRunId: () => {},
});

export function AiQueryProvider({
  children,
  strategy,
}: {
  children: ReactNode;
  strategy?: AskSeerStrategy;
}) {
  const [runId, setRunId] = useState<number | string | null>(null);
  const lastTrackedRunId = useRef<number | string | null>(null);

  const getRunIdForAnalyticsBox = useRef<() => number | string | null>(() => null);
  // oxlint-disable-next-line react/refs
  getRunIdForAnalyticsBox.current = () => {
    if (runId === lastTrackedRunId.current) {
      return null;
    }
    lastTrackedRunId.current = runId;
    return runId;
  };

  // Stable callback that dispatches to the latest closure via ref.
  const getRunIdForAnalytics = useCallback(() => getRunIdForAnalyticsBox.current(), []);

  const value = useMemo(
    () => ({getRunIdForAnalytics, setRunId, strategy}),
    [getRunIdForAnalytics, strategy]
  );

  return <AiQueryContext.Provider value={value}>{children}</AiQueryContext.Provider>;
}

export function useAiQueryContext() {
  return useContext(AiQueryContext);
}
