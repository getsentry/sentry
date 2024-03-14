import {createContext, useContext, useMemo} from 'react';

import {useMetricsMeta} from 'sentry/utils/metrics/useMetricsMeta';
import usePageFilters from 'sentry/utils/usePageFilters';

interface MetricsDashboardContextValue {
  isLoading: boolean;
  metricsMeta: ReturnType<typeof useMetricsMeta>['data'];
}

export const MetricsDashboardContext = createContext<MetricsDashboardContextValue>({
  metricsMeta: [],
  isLoading: false,
});

export function useMetricsDashboardContext() {
  return useContext(MetricsDashboardContext);
}

export function MetricsDashboardContextProvider({children}: {children: React.ReactNode}) {
  const pageFilters = usePageFilters().selection;
  const metricsMetaQuery = useMetricsMeta(pageFilters);

  const contextValue = useMemo(() => {
    return {
      metricsMeta: metricsMetaQuery.data,
      isLoading: metricsMetaQuery.isLoading,
    };
  }, [metricsMetaQuery]);

  return (
    <MetricsDashboardContext.Provider value={contextValue}>
      {children}
    </MetricsDashboardContext.Provider>
  );
}
