import {createContext, useContext} from 'react';

interface TraceExploreAiQueryContextValue {}

export const TraceExploreAiQueryContext = createContext<
  TraceExploreAiQueryContextValue | undefined
>(undefined);

export const useTraceExploreAiQueryContext = () => {
  return useContext(TraceExploreAiQueryContext);
};
