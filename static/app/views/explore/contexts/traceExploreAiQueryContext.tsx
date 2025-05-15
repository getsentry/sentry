import {createContext, useContext} from 'react';

interface TraceExploreAiQueryContextValue {
  onAiButtonClick: (initialQuery?: string) => void;
}

export const TraceExploreAiQueryContext = createContext<
  TraceExploreAiQueryContextValue | undefined
>(undefined);

export const useTraceExploreAiQueryContext = () => {
  return useContext(TraceExploreAiQueryContext);
};
