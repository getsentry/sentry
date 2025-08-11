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
      // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
      acc[webVital] =
        (webVitals.includes(webVital as WebVitals)
          ? // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
            PERFORMANCE_SCORE_WEIGHTS[webVital] * 100
          : 0) / totalWeight;
      return acc;
    },
    {} as Record<WebVitals, number>
  );
}
