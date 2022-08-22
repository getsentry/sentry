import {PROJECT_PERFORMANCE_TYPE} from 'sentry/views/performance/utils';

import {createDefinedContext} from './utils';

type useCurrentPerformanceView = {
  performanceType: PROJECT_PERFORMANCE_TYPE;
};

const [PerformanceDisplayProvider, _usePerformanceDisplayType] =
  createDefinedContext<useCurrentPerformanceView>({
    name: 'CurrentPerformanceViewContext',
  });

export {PerformanceDisplayProvider};

export function usePerformanceDisplayType(): PROJECT_PERFORMANCE_TYPE {
  return _usePerformanceDisplayType().performanceType;
}
