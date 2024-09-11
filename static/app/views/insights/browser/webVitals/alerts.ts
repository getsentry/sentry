import type {AlertConfig} from 'sentry/views/insights/common/components/chartPanel';

export const ALERTS: Record<string, AlertConfig> = {
  lcp: {
    aggregate: 'performance_score(d:transactions/measurements.score.lcp@ratio)',
    query: 'has:measurements.score.total',
    name: 'Create LCP Score Alert',
  },
  fcp: {
    aggregate: 'performance_score(measurements.score.fcp)',
    query: 'has:measurements.score.total',
    name: 'Create FCP Score Alert',
  },
  cls: {
    aggregate: 'performance_score(measurements.score.cls)',
    query: 'has:measurements.score.total',
    name: 'Create CLS Score Alert',
  },
  ttfb: {
    aggregate: 'performance_score(measurements.score.ttfb)',
    query: 'has:measurements.score.total',
    name: 'Create TTFB Score Alert',
  },
  inp: {
    aggregate: 'performance_score(measurements.score.inp)',
    query: 'has:measurements.score.total',
    name: 'Create INP Score Alert',
  },
  total: {
    aggregate: 'performance_score(measurements.score.total)',
    query: 'has:measurements.score.total',
    name: 'Create Total Score Alert',
  },
};
