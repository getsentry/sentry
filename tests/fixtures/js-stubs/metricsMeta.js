export function MetricsMeta(additionalMeta = []) {
  return [
    {
      name: 'sentry.sessions.session',
      type: 'counter',
      operations: ['sum'],
      unit: null,
    },
    {
      name: 'sentry.sessions.session.error',
      type: 'set',
      operations: ['count_unique'],
      unit: null,
    },
    {
      name: 'sentry.sessions.user',
      type: 'set',
      operations: ['count_unique'],
      unit: null,
    },
    {
      name: 'sentry.transactions.measurements.fcp',
      type: 'distribution',
      operations: ['avg', 'count', 'max', 'min', 'p50', 'p75', 'p90', 'p95', 'p99'],
      unit: null,
    },
    {
      name: 'sentry.transactions.measurements.fid',
      type: 'distribution',
      operations: ['avg', 'count', 'max', 'min', 'p50', 'p75', 'p90', 'p95', 'p99'],
      unit: null,
    },
    {
      name: 'sentry.transactions.measurements.fp',
      type: 'distribution',
      operations: ['avg', 'count', 'max', 'min', 'p50', 'p75', 'p90', 'p95', 'p99'],
      unit: null,
    },
    {
      name: 'sentry.transactions.measurements.lcp',
      type: 'distribution',
      operations: ['avg', 'count', 'max', 'min', 'p50', 'p75', 'p90', 'p95', 'p99'],
      unit: null,
    },
    {
      name: 'sentry.transactions.measurements.ttfb',
      type: 'distribution',
      operations: ['avg', 'count', 'max', 'min', 'p50', 'p75', 'p90', 'p95', 'p99'],
      unit: null,
    },
    {
      name: 'sentry.transactions.measurements.ttfb.requesttime',
      type: 'distribution',
      operations: ['avg', 'count', 'max', 'min', 'p50', 'p75', 'p90', 'p95', 'p99'],
      unit: null,
    },
    {
      name: 'sentry.transactions.transaction.duration',
      type: 'distribution',
      operations: ['avg', 'count', 'max', 'min', 'p50', 'p75', 'p90', 'p95', 'p99'],
      unit: null,
    },
    {
      name: 'sentry.transactions.user',
      type: 'set',
      operations: ['count_unique'],
      unit: null,
    },
    {
      name: 'session.crash_free_rate',
      type: 'numeric',
      operations: [],
      unit: null,
    },
    ...additionalMeta,
  ];
}
