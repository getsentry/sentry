import {ProjectScore} from 'sentry/views/performance/browser/webVitals/utils/queries/rawWebVitalsQueries/calculatePerformanceScore';

export const getWeights = (projectScore?: ProjectScore) => {
  const containsWeights = (
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

  const weights =
    projectScore && containsWeights(projectScore)
      ? {
          cls: projectScore.clsWeight,
          fcp: projectScore.fcpWeight,
          fid: projectScore.fidWeight,
          lcp: projectScore.lcpWeight,
          ttfb: projectScore.ttfbWeight,
        }
      : undefined;
  return weights;
};
