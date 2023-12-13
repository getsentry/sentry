import {ProjectScore} from 'sentry/views/performance/browser/webVitals/utils/queries/rawWebVitalsQueries/calculatePerformanceScore';

export const containsWeights = (
  weights: ProjectScore
): weights is ProjectScore & {
  clsWeight: number;
  fcpWeight: number;
  fidWeight: number;
  lcpWeight: number;
  ttfbWeight: number;
} => {
  return !!(
    weights?.clsWeight &&
    weights?.fcpWeight &&
    weights?.fidWeight &&
    weights?.lcpWeight &&
    weights?.ttfbWeight
  );
};
