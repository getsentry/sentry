import invert from 'lodash/invert';

import {MetricsOperation, MetricsType} from 'sentry/types';

import {ColumnType} from '../discover/fields';

export enum SessionMetric {
  SESSION = 'sentry.sessions.session',
  SESSION_DURATION = 'sentry.sessions.session.duration',
  SESSION_ERROR = 'sentry.sessions.session.error',
  USER = 'sentry.sessions.user',
}

export enum TransactionMetric {
  MEASUREMENTS_FP = 'sentry.transactions.measurements.fp',
  MEASUREMENTS_FCP = 'sentry.transactions.measurements.fcp',
  MEASUREMENTS_LCP = 'sentry.transactions.measurements.lcp',
  MEASUREMENTS_FID = 'sentry.transactions.measurements.fid',
  MEASUREMENTS_CLS = 'sentry.transactions.measurements.cls',
  MEASUREMENTS_TTFB = 'sentry.transactions.measurements.ttfb',
  MEASUREMENTS_TTFB_REQUESTTIME = 'sentry.transactions.measurements.ttfb.requesttime',
  MEASUREMENTS_APP_START_COLD = 'sentry.transactions.measurements.app_start_cold',
  MEASUREMENTS_APP_START_WARM = 'sentry.transactions.measurements.app_start_warm',
  MEASUREMENTS_FRAMES_TOTAL = 'sentry.transactions.measurements.frames_total',
  MEASUREMENTS_FRAMES_SLOW = 'sentry.transactions.measurements.frames_slow',
  MEASUREMENTS_FRAMES_FROZEN = 'sentry.transactions.measurements.frames_frozen',
  MEASUREMENTS_FRAMES_SLOW_RATE = 'sentry.transactions.measurements.frames_slow_rate',
  MEASUREMENTS_FRAMES_FROZEN_RATE = 'sentry.transactions.measurements.frames_frozen_rate',
  MEASUREMENTS_STALL_COUNT = 'sentry.transactions.measurements.stall_count',
  MEASUREMENTS_STALL_TOTAL_TIME = 'sentry.transactions.measurements.stall_total_time',
  MEASUREMENTS_STALL_LONGEST_TIME = 'sentry.transactions.measurements.stall_longest_time',
  MEASUREMENTS_STALL_PERCENTAGE = 'sentry.transactions.measurements.stall_percentage',
  TRANSACTION_DURATION = 'sentry.transactions.transaction.duration',
  USER = 'sentry.transactions.user',
  TRANSACTION = 'transaction',
}

export const METRIC_TO_COLUMN_TYPE: Readonly<
  Record<SessionMetric | TransactionMetric, ColumnType>
> = {
  // Session metrics
  [SessionMetric.USER]: 'integer',
  [SessionMetric.SESSION_ERROR]: 'integer',
  [SessionMetric.SESSION_DURATION]: 'duration',
  [SessionMetric.SESSION]: 'integer',

  // Transaction metrics
  [TransactionMetric.USER]: 'integer',
  [TransactionMetric.TRANSACTION]: 'string',
  [TransactionMetric.TRANSACTION_DURATION]: 'duration',
  [TransactionMetric.MEASUREMENTS_FP]: 'duration',
  [TransactionMetric.MEASUREMENTS_FCP]: 'duration',
  [TransactionMetric.MEASUREMENTS_LCP]: 'duration',
  [TransactionMetric.MEASUREMENTS_FID]: 'duration',
  [TransactionMetric.MEASUREMENTS_CLS]: 'number',
  [TransactionMetric.MEASUREMENTS_TTFB]: 'duration',
  [TransactionMetric.MEASUREMENTS_TTFB_REQUESTTIME]: 'duration',
  [TransactionMetric.MEASUREMENTS_APP_START_COLD]: 'duration',
  [TransactionMetric.MEASUREMENTS_APP_START_WARM]: 'duration',
  [TransactionMetric.MEASUREMENTS_FRAMES_TOTAL]: 'integer',
  [TransactionMetric.MEASUREMENTS_FRAMES_SLOW]: 'integer',
  [TransactionMetric.MEASUREMENTS_FRAMES_FROZEN]: 'integer',
  [TransactionMetric.MEASUREMENTS_FRAMES_SLOW_RATE]: 'percentage',
  [TransactionMetric.MEASUREMENTS_FRAMES_FROZEN_RATE]: 'percentage',
  [TransactionMetric.MEASUREMENTS_STALL_COUNT]: 'integer',
  [TransactionMetric.MEASUREMENTS_STALL_TOTAL_TIME]: 'duration',
  [TransactionMetric.MEASUREMENTS_STALL_LONGEST_TIME]: 'duration',
  [TransactionMetric.MEASUREMENTS_STALL_PERCENTAGE]: 'percentage',
};

export const METRICS_OPERATIONS: Readonly<
  Record<
    MetricsOperation,
    {defaultValue: SessionMetric | TransactionMetric; metricsTypes: MetricsType[]}
  >
> = {
  sum: {
    metricsTypes: ['counter'],
    defaultValue: SessionMetric.SESSION,
  },
  count_unique: {
    metricsTypes: ['set'],
    defaultValue: SessionMetric.USER,
  },
  avg: {
    metricsTypes: ['distribution'],
    defaultValue: TransactionMetric.TRANSACTION_DURATION,
  },
  count: {
    metricsTypes: ['distribution'],
    defaultValue: TransactionMetric.TRANSACTION_DURATION,
  },
  max: {
    metricsTypes: ['distribution'],
    defaultValue: TransactionMetric.TRANSACTION_DURATION,
  },
  p50: {
    metricsTypes: ['distribution'],
    defaultValue: TransactionMetric.TRANSACTION_DURATION,
  },
  p75: {
    metricsTypes: ['distribution'],
    defaultValue: TransactionMetric.TRANSACTION_DURATION,
  },
  p95: {
    metricsTypes: ['distribution'],
    defaultValue: TransactionMetric.TRANSACTION_DURATION,
  },
  p99: {
    metricsTypes: ['distribution'],
    defaultValue: TransactionMetric.TRANSACTION_DURATION,
  },
};

// This is not the full map, just what we need for performance table.
// In the future we might want something more generic that strips the aggregate functions.
const DISCOVER_FIELD_TO_METRIC = {
  'count_unique(user)': `count_unique(${TransactionMetric.USER})`,
  'tpm()': `count(${TransactionMetric.TRANSACTION_DURATION})`,
  'p75(measurements.fcp)': `p75(${TransactionMetric.MEASUREMENTS_FCP})`,
  'p75(measurements.lcp)': `p75(${TransactionMetric.MEASUREMENTS_LCP})`,
  'p75(measurements.fid)': `p75(${TransactionMetric.MEASUREMENTS_FID})`,
  'p75(measurements.cls)': `p75(${TransactionMetric.MEASUREMENTS_CLS})`,
  'p50()': `p50(${TransactionMetric.TRANSACTION_DURATION})`,
  'p95()': `p95(${TransactionMetric.TRANSACTION_DURATION})`,
  'p50(transaction.duration)': `p50(${TransactionMetric.TRANSACTION_DURATION})`,
  'p75(transaction.duration)': `p75(${TransactionMetric.TRANSACTION_DURATION})`,
  'p95(transaction.duration)': `p95(${TransactionMetric.TRANSACTION_DURATION})`,
  'p75(measurements.app_start_cold)': `p75(${TransactionMetric.MEASUREMENTS_APP_START_COLD})`,
  'p75(measurements.app_start_warm)': `p75(${TransactionMetric.MEASUREMENTS_APP_START_WARM})`,
  'p75(measurements.frames_slow_rate)': `p75(${TransactionMetric.MEASUREMENTS_FRAMES_SLOW_RATE})`,
  'p75(measurements.frames_frozen_rate)': `p75(${TransactionMetric.MEASUREMENTS_FRAMES_FROZEN_RATE})`,

  // TODO(metrics):
  // transaction.op
  // http.method
  // failure_rate()
  // apdex()
  // count_miserable(user)
  // user_misery()
  // team_key_transaction
};

const DISCOVER_FIELD_TO_METRIC_GROUP_BY = {
  transaction: 'transaction',
  project: 'project_id',
};

const METRIC_TO_DISCOVER_FIELD = invert(DISCOVER_FIELD_TO_METRIC);
const METRIC_GROUP_BY_TO_DISCOVER_FIELD = invert(DISCOVER_FIELD_TO_METRIC_GROUP_BY);

export function convertDiscoverFieldsToMetrics<T extends string | string[]>(
  discoverFields: T
): T {
  if (Array.isArray(discoverFields)) {
    return discoverFields
      .map(field => DISCOVER_FIELD_TO_METRIC[field])
      .filter(metric => metric !== undefined) as T;
  }

  return DISCOVER_FIELD_TO_METRIC[discoverFields as string] ?? '';
}

export function convertDiscoverFieldsToMetricsGroupBys<T extends string | string[]>(
  discoverFields: T
): T {
  if (Array.isArray(discoverFields)) {
    return discoverFields
      .map(field => DISCOVER_FIELD_TO_METRIC_GROUP_BY[field])
      .filter(metricGroupBy => metricGroupBy !== undefined) as T;
  }

  return DISCOVER_FIELD_TO_METRIC_GROUP_BY[discoverFields as string] ?? '';
}

export function convertMetricsToDiscoverFields<T extends string | string[]>(
  metrics: T
): T {
  if (Array.isArray(metrics)) {
    return metrics
      .map(metric => METRIC_TO_DISCOVER_FIELD[metric])
      .filter(field => field !== undefined) as T;
  }

  return (METRIC_TO_DISCOVER_FIELD[metrics as string] ?? '') as T;
}

export function convertMetricsGroupBysToDiscoverFields<T extends string | string[]>(
  metricsGroupBys: T
): T {
  if (Array.isArray(metricsGroupBys)) {
    return metricsGroupBys
      .map(metricGroupBy => METRIC_GROUP_BY_TO_DISCOVER_FIELD[metricGroupBy])
      .filter(field => field !== undefined) as T;
  }

  return (METRIC_GROUP_BY_TO_DISCOVER_FIELD[metricsGroupBys as string] ?? '') as T;
}
