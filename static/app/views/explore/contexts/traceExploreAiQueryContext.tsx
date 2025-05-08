import {createContext, useContext} from 'react';

export interface TraceExploreAiQueryContextValue {
  onAiButtonClick: (initialQuery?: string) => void;
}

export const TraceExploreAiQueryContext = createContext<
  TraceExploreAiQueryContextValue | undefined
>(undefined);

export const useTraceExploreAiQueryContext = () => {
  const context = useContext(TraceExploreAiQueryContext);
  if (!context) {
    throw new Error(
      'useTraceExploreAiQueryContext must be used within a TraceExploreAiQueryProvider'
    );
  }
  return context;
};
