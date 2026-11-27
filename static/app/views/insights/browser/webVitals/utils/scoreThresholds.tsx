import type {WebVitals} from 'sentry/views/insights/browser/webVitals/types';

import type {DeviceType} from './deviceType';

export const PERFORMANCE_SCORE_WEIGHTS: Record<WebVitals, number> = {
  lcp: 30,
  fcp: 15,
  inp: 30,
  cls: 15,
  ttfb: 10,
};

// These mirror the score profiles Relay applies per browser, see
// `src/sentry/relay/config/__init__.py`. Mobile browsers are scored on a
// looser curve, so the same value can be "Good" on mobile and "Poor" on desktop.
const PERFORMANCE_SCORE_MEDIANS: Record<WebVitals, number> = {
  lcp: 2400,
  fcp: 1600,
  cls: 0.25,
  ttfb: 400,
  inp: 500,
};

const PERFORMANCE_SCORE_P90S: Record<WebVitals, number> = {
  lcp: 1200,
  fcp: 900,
  cls: 0.1,
  ttfb: 200,
  inp: 200,
};

const MOBILE_PERFORMANCE_SCORE_MEDIANS: Record<WebVitals, number> = {
  lcp: 4000,
  fcp: 3000,
  cls: 0.25,
  ttfb: 1800,
  inp: 500,
};

const MOBILE_PERFORMANCE_SCORE_P90S: Record<WebVitals, number> = {
  lcp: 2500,
  fcp: 1800,
  cls: 0.1,
  ttfb: 800,
  inp: 200,
};

export function getWebVitalScoreThresholds(
  webVital: WebVitals,
  deviceType: DeviceType
): {median: number; p90: number} {
  return deviceType === 'mobile'
    ? {
        p90: MOBILE_PERFORMANCE_SCORE_P90S[webVital],
        median: MOBILE_PERFORMANCE_SCORE_MEDIANS[webVital],
      }
    : {
        p90: PERFORMANCE_SCORE_P90S[webVital],
        median: PERFORMANCE_SCORE_MEDIANS[webVital],
      };
}
