import {PROJECT_PERFORMANCE_TYPE} from 'app/views/performance/utils';

import {createDefinedContext} from './utils';

type useCurrentPerformanceView = {
  performanceType: PROJECT_PERFORMANCE_TYPE;
};

const [CurrentPerformanceViewProvider, _useCurrentPerformanceType] =
  createDefinedContext<useCurrentPerformanceView>({
    name: 'CurrentPerformanceViewContext',
  });

export {CurrentPerformanceViewProvider};

export function useCurrentPerformanceType(): PROJECT_PERFORMANCE_TYPE {
  return _useCurrentPerformanceType().performanceType;
}
