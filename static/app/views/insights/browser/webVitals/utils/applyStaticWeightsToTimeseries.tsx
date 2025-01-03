import type {Organization} from 'sentry/types/organization';
import type {WebVitalsScoreBreakdown} from 'sentry/views/insights/browser/webVitals/queries/storedScoreQueries/useProjectWebVitalsScoresTimeseriesQuery';
import type {WebVitals} from 'sentry/views/insights/browser/webVitals/types';
import {getWeights} from 'sentry/views/insights/browser/webVitals/utils/getWeights';
import {PERFORMANCE_SCORE_WEIGHTS} from 'sentry/views/insights/browser/webVitals/utils/scoreThresholds';

// Returns a weighed score timeseries with each interval calculated from applying hardcoded weights to unweighted scores
export function applyStaticWeightsToTimeseries(
  organization: Organization,
  timeseriesData: WebVitalsScoreBreakdown
) {
  const weights = organization.features.includes(
    'organizations:performance-vitals-handle-missing-webvitals'
  )
    ? getWeights(
        Object.keys(timeseriesData)
          .filter(key => key !== 'total')
          .filter(key =>
            timeseriesData[key].some(series => series.value > 0)
          ) as WebVitals[]
      )
    : PERFORMANCE_SCORE_WEIGHTS;
  return {
    ...Object.keys(weights).reduce((acc, webVital) => {
      acc[webVital] = timeseriesData[webVital].map(({name, value}) => ({
        name,
        value: value * weights[webVital] * 0.01,
      }));
      return acc;
    }, {}),
    total: timeseriesData.total,
  } as WebVitalsScoreBreakdown;
}
