import type {WebVitalsScoreBreakdown} from 'sentry/views/insights/browser/webVitals/queries/storedScoreQueries/useProjectWebVitalsScoresTimeseriesQuery';
import type {WebVitals} from 'sentry/views/insights/browser/webVitals/types';
import {getWeights} from 'sentry/views/insights/browser/webVitals/utils/getWeights';

// Returns a weighed score timeseries with each interval calculated from applying hardcoded weights to unweighted scores
export function applyStaticWeightsToTimeseries(timeseriesData: WebVitalsScoreBreakdown) {
  const weights = getWeights(
    Object.keys(timeseriesData)
      .filter(key => key !== 'total')
      .filter(key =>
        timeseriesData[key as WebVitals].some((series: any) => series.value > 0)
      ) as WebVitals[]
  );
  return {
    ...Object.keys(weights).reduce(
      (acc: Partial<WebVitalsScoreBreakdown>, webVitalString) => {
        const webVital = webVitalString as WebVitals;
        acc[webVital] = timeseriesData[webVital].map(({name, value}: any) => ({
          name,
          value: value * weights[webVital] * 0.01,
        }));
        return acc;
      },
      {}
    ),
    total: timeseriesData.total,
  } as WebVitalsScoreBreakdown;
}
