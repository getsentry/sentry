import type {
  UnweightedWebVitalsScoreBreakdown,
  WebVitalsScoreBreakdown,
} from 'sentry/views/insights/browser/webVitals/queries/storedScoreQueries/useProjectWebVitalsScoresTimeseriesQuery';
import {PERFORMANCE_SCORE_WEIGHTS} from 'sentry/views/insights/browser/webVitals/utils/scoreThresholds';

// Returns a weighed score timeseries with each interval calculated from applying hardcoded weights to unweighted scores
export function applyStaticWeightsToTimeseries(
  timeseriesData: WebVitalsScoreBreakdown & UnweightedWebVitalsScoreBreakdown
) {
  return {
    ...Object.keys(PERFORMANCE_SCORE_WEIGHTS).reduce((acc, webVital) => {
      acc[webVital] = timeseriesData[
        `unweighted${webVital.charAt(0).toUpperCase()}${webVital.slice(1)}`
      ].map(({name, value}) => ({
        name,
        value: value * PERFORMANCE_SCORE_WEIGHTS[webVital] * 0.01,
      }));
      return acc;
    }, {}),
    total: timeseriesData.total,
  } as WebVitalsScoreBreakdown & UnweightedWebVitalsScoreBreakdown;
}
