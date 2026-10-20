import {ORDER} from 'sentry/views/insights/browser/webVitals/types';
import type {WebVitals} from 'sentry/views/insights/browser/webVitals/types';
import {PERFORMANCE_SCORE_WEIGHTS} from 'sentry/views/insights/browser/webVitals/utils/scoreThresholds';

/**
 * Redistributes the performance score weights across the web vitals that have data,
 * as percentages that sum to 100. Web vitals without data get a weight of 0.
 */
export function getWeights(webVitals: WebVitals[] = []): Record<WebVitals, number> {
  const webVitalsWithData = ORDER.filter(webVital => webVitals.includes(webVital));
  const totalWeight = webVitalsWithData.reduce(
    (acc, webVital) => acc + PERFORMANCE_SCORE_WEIGHTS[webVital],
    0
  );

  return ORDER.reduce(
    (acc, webVital) => {
      // When no web vital has data the total is 0, so return 0 instead of dividing into NaN
      acc[webVital] =
        totalWeight > 0 && webVitalsWithData.includes(webVital)
          ? (PERFORMANCE_SCORE_WEIGHTS[webVital] * 100) / totalWeight
          : 0;
      return acc;
    },
    {} as Record<WebVitals, number>
  );
}
