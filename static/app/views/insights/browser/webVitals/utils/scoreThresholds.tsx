import type {WebVitals} from 'sentry/views/insights/browser/webVitals/types';

export const PERFORMANCE_SCORE_WEIGHTS: Record<WebVitals, number> = {
  lcp: 30,
  fcp: 15,
  inp: 30,
  cls: 15,
  ttfb: 10,
};

export const PERFORMANCE_SCORE_MEDIANS: Record<WebVitals, number> = {
  lcp: 2400,
  fcp: 1600,
  cls: 0.25,
  ttfb: 400,
  inp: 500,
};

export const PERFORMANCE_SCORE_P90S: Record<WebVitals, number> = {
  lcp: 1200,
  fcp: 900,
  cls: 0.1,
  ttfb: 200,
  inp: 200,
};
