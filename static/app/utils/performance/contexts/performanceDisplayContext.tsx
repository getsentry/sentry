import {ProjectPerformanceType} from 'sentry/views/performance/utils';

import {createDefinedContext} from './utils';

type useCurrentPerformanceView = {
  performanceType: ProjectPerformanceType;
};

const [PerformanceDisplayProvider, _usePerformanceDisplayType] =
  createDefinedContext<useCurrentPerformanceView>({
    name: 'CurrentPerformanceViewContext',
  });

export {PerformanceDisplayProvider};

export function usePerformanceDisplayType(): ProjectPerformanceType {
  return _usePerformanceDisplayType().performanceType;
}
