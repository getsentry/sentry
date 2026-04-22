import type {ProjectPerformanceType} from 'sentry/views/performance/utils';

import {createDefinedContext} from './utils';

interface UseCurrentPerformanceView {
  performanceType: ProjectPerformanceType;
}

const [PerformanceDisplayProvider, _usePerformanceDisplayType] =
  createDefinedContext<UseCurrentPerformanceView>({
    name: 'CurrentPerformanceViewContext',
  });

export {PerformanceDisplayProvider};

export function usePerformanceDisplayType(): ProjectPerformanceType {
  return _usePerformanceDisplayType().performanceType;
}
