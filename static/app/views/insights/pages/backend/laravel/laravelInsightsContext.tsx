import {createContext, useContext} from 'react';

const laravelInsightsContext = createContext<{
  isLaravelInsightsEnabled: boolean;
  setIsLaravelInsightsEnabled: (isLaravelInsightsEnabled: boolean) => void;
}>({
  isLaravelInsightsEnabled: false,
  setIsLaravelInsightsEnabled: () => {},
});

export const LaravelInsightsProvider = laravelInsightsContext.Provider;

export const useLaravelInsightsContext = () => useContext(laravelInsightsContext);
