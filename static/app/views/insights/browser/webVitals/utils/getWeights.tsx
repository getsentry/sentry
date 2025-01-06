import {ORDER} from 'sentry/views/insights/browser/webVitals/components/charts/performanceScoreChart';
import type {WebVitals} from 'sentry/views/insights/browser/webVitals/types';
import {PERFORMANCE_SCORE_WEIGHTS} from 'sentry/views/insights/browser/webVitals/utils/scoreThresholds';

export function getWeights(webVitals: WebVitals[] = []): Record<WebVitals, number> {
  const totalWeight = ORDER.filter(webVital => webVitals.includes(webVital)).reduce(
    (acc, webVital) => acc + PERFORMANCE_SCORE_WEIGHTS[webVital],
    0
  );
  return Object.keys(PERFORMANCE_SCORE_WEIGHTS).reduce(
    (acc, webVital) => {
      acc[webVital] =
        (webVitals.includes(webVital as WebVitals)
          ? PERFORMANCE_SCORE_WEIGHTS[webVital] * 100
          : 0) / totalWeight;
      return acc;
    },
    {} as Record<WebVitals, number>
  );
}
