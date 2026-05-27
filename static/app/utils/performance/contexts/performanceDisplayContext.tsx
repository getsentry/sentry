import {createContext, useContext} from 'react';

import type {ProjectPerformanceType} from 'sentry/views/performance/utils';

type UseCurrentPerformanceView = {
  performanceType: ProjectPerformanceType;
};

export const PerformanceDisplayContext = createContext<
  UseCurrentPerformanceView | undefined
>(undefined);

export function usePerformanceDisplayType(): ProjectPerformanceType {
  const context = useContext(PerformanceDisplayContext);
  if (context === undefined) {
    throw new Error(
      'useContext for "CurrentPerformanceViewContext" must be inside a Provider with a value'
    );
  }
  return context.performanceType;
}
