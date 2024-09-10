import type {AlertConfig} from 'sentry/views/insights/common/components/chartPanel';

export const ALERTS: Record<string, AlertConfig> = {
  lcp: {
    aggregate: 'performance_score(measurements.score.lcp)',
    query: '!transaction:"<< unparameterized >>"',
    name: 'Create LCP Score Alert',
  },
  fcp: {
    aggregate: 'performance_score(measurements.score.fcp)',
    query: '!transaction:"<< unparameterized >>"',
    name: 'Create FCP Score Alert',
  },
  cls: {
    aggregate: 'performance_score(measurements.score.cls)',
    query: '!transaction:"<< unparameterized >>"',
    name: 'Create CLS Score Alert',
  },
  ttfb: {
    aggregate: 'performance_score(measurements.score.ttfb)',
    query: '!transaction:"<< unparameterized >>"',
    name: 'Create TTFB Score Alert',
  },
  inp: {
    aggregate: 'performance_score(measurements.score.inp)',
    query: '!transaction:"<< unparameterized >>"',
    name: 'Create INP Score Alert',
  },
  total: {
    aggregate: 'performance_score(measurements.score.total)',
    query: '!transaction:"<< unparameterized >>"',
    name: 'Create Total Score Alert',
  },
};
