import invert from 'lodash/invert';

import {ColumnType} from '../discover/fields';

export enum SessionMetric {
  SENTRY_SESSIONS_SESSION = 'sentry.sessions.session',
  SENTRY_SESSIONS_SESSION_DURATION = 'sentry.sessions.session.duration',
  SENTRY_SESSIONS_SESSION_ERROR = 'sentry.sessions.session.error',
  SENTRY_SESSIONS_USER = 'sentry.sessions.user',
}

export enum TransactionMetric {
  SENTRY_TRANSACTIONS_MEASUREMENTS_FP = 'sentry.transactions.measurements.fp',
  SENTRY_TRANSACTIONS_MEASUREMENTS_FCP = 'sentry.transactions.measurements.fcp',
  SENTRY_TRANSACTIONS_MEASUREMENTS_LCP = 'sentry.transactions.measurements.lcp',
  SENTRY_TRANSACTIONS_MEASUREMENTS_FID = 'sentry.transactions.measurements.fid',
  SENTRY_TRANSACTIONS_MEASUREMENTS_CLS = 'sentry.transactions.measurements.cls',
  SENTRY_TRANSACTIONS_MEASUREMENTS_TTFB = 'sentry.transactions.measurements.ttfb',
  SENTRY_TRANSACTIONS_MEASUREMENTS_TTFB_REQUESTTIME = 'sentry.transactions.measurements.ttfb.requesttime',
  SENTRY_TRANSACTIONS_MEASUREMENTS_APP_START_COLD = 'sentry.transactions.measurements.app_start_cold',
  SENTRY_TRANSACTIONS_MEASUREMENTS_APP_START_WARM = 'sentry.transactions.measurements.app_start_warm',
  SENTRY_TRANSACTIONS_MEASUREMENTS_FRAMES_TOTAL = 'sentry.transactions.measurements.frames_total',
  SENTRY_TRANSACTIONS_MEASUREMENTS_FRAMES_SLOW = 'sentry.transactions.measurements.frames_slow',
  SENTRY_TRANSACTIONS_MEASUREMENTS_FRAMES_FROZEN = 'sentry.transactions.measurements.frames_frozen',
  SENTRY_TRANSACTIONS_MEASUREMENTS_FRAMES_SLOW_RATE = 'sentry.transactions.measurements.frames_slow_rate',
  SENTRY_TRANSACTIONS_MEASUREMENTS_FRAMES_FROZEN_RATE = 'sentry.transactions.measurements.frames_frozen_rate',
  SENTRY_TRANSACTIONS_MEASUREMENTS_STALL_COUNT = 'sentry.transactions.measurements.stall_count',
  SENTRY_TRANSACTIONS_MEASUREMENTS_STALL_TOTAL_TIME = 'sentry.transactions.measurements.stall_total_time',
  SENTRY_TRANSACTIONS_MEASUREMENTS_STALL_LONGEST_TIME = 'sentry.transactions.measurements.stall_longest_time',
  SENTRY_TRANSACTIONS_MEASUREMENTS_STALL_PERCENTAGE = 'sentry.transactions.measurements.stall_percentage',
  SENTRY_TRANSACTIONS_TRANSACTION_DURATION = 'sentry.transactions.transaction.duration',
  SENTRY_TRANSACTIONS_USER = 'sentry.transactions.user',
  SENTRY_TRANSACTIONS_TRANSACTION = 'transaction',
}

export const METRIC_TO_COLUMN_TYPE: Readonly<
  Record<SessionMetric | TransactionMetric, ColumnType>
> = {
  // Session metrics
  [SessionMetric.SENTRY_SESSIONS_USER]: 'integer',
  [SessionMetric.SENTRY_SESSIONS_SESSION_ERROR]: 'integer',
  [SessionMetric.SENTRY_SESSIONS_SESSION_DURATION]: 'duration',
  [SessionMetric.SENTRY_SESSIONS_SESSION]: 'integer',

  // Transaction metrics
  [TransactionMetric.SENTRY_TRANSACTIONS_USER]: 'integer',
  [TransactionMetric.SENTRY_TRANSACTIONS_TRANSACTION]: 'string',
  [TransactionMetric.SENTRY_TRANSACTIONS_TRANSACTION_DURATION]: 'duration',
  [TransactionMetric.SENTRY_TRANSACTIONS_MEASUREMENTS_FP]: 'duration',
  [TransactionMetric.SENTRY_TRANSACTIONS_MEASUREMENTS_FCP]: 'duration',
  [TransactionMetric.SENTRY_TRANSACTIONS_MEASUREMENTS_LCP]: 'duration',
  [TransactionMetric.SENTRY_TRANSACTIONS_MEASUREMENTS_FID]: 'duration',
  [TransactionMetric.SENTRY_TRANSACTIONS_MEASUREMENTS_CLS]: 'number',
  [TransactionMetric.SENTRY_TRANSACTIONS_MEASUREMENTS_TTFB]: 'duration',
  [TransactionMetric.SENTRY_TRANSACTIONS_MEASUREMENTS_TTFB_REQUESTTIME]: 'duration',
  [TransactionMetric.SENTRY_TRANSACTIONS_MEASUREMENTS_APP_START_COLD]: 'duration',
  [TransactionMetric.SENTRY_TRANSACTIONS_MEASUREMENTS_APP_START_WARM]: 'duration',
  [TransactionMetric.SENTRY_TRANSACTIONS_MEASUREMENTS_FRAMES_TOTAL]: 'integer',
  [TransactionMetric.SENTRY_TRANSACTIONS_MEASUREMENTS_FRAMES_SLOW]: 'integer',
  [TransactionMetric.SENTRY_TRANSACTIONS_MEASUREMENTS_FRAMES_FROZEN]: 'integer',
  [TransactionMetric.SENTRY_TRANSACTIONS_MEASUREMENTS_FRAMES_SLOW_RATE]: 'percentage',
  [TransactionMetric.SENTRY_TRANSACTIONS_MEASUREMENTS_FRAMES_FROZEN_RATE]: 'percentage',
  [TransactionMetric.SENTRY_TRANSACTIONS_MEASUREMENTS_STALL_COUNT]: 'integer',
  [TransactionMetric.SENTRY_TRANSACTIONS_MEASUREMENTS_STALL_TOTAL_TIME]: 'duration',
  [TransactionMetric.SENTRY_TRANSACTIONS_MEASUREMENTS_STALL_LONGEST_TIME]: 'duration',
  [TransactionMetric.SENTRY_TRANSACTIONS_MEASUREMENTS_STALL_PERCENTAGE]: 'percentage',
};

// This is not the full map, just what we need for performance table.
// In the future we might want something more generic that strips the aggregate functions.
const DISCOVER_FIELD_TO_METRIC = {
  'count_unique(user)': `count_unique(${TransactionMetric.SENTRY_TRANSACTIONS_USER})`,
  'tpm()': `count(${TransactionMetric.SENTRY_TRANSACTIONS_TRANSACTION_DURATION})`,
  'p75(measurements.fcp)': `p75(${TransactionMetric.SENTRY_TRANSACTIONS_MEASUREMENTS_FCP})`,
  'p75(measurements.lcp)': `p75(${TransactionMetric.SENTRY_TRANSACTIONS_MEASUREMENTS_LCP})`,
  'p75(measurements.fid)': `p75(${TransactionMetric.SENTRY_TRANSACTIONS_MEASUREMENTS_FID})`,
  'p75(measurements.cls)': `p75(${TransactionMetric.SENTRY_TRANSACTIONS_MEASUREMENTS_CLS})`,
  'p50()': `p50(${TransactionMetric.SENTRY_TRANSACTIONS_TRANSACTION_DURATION})`,
  'p95()': `p95(${TransactionMetric.SENTRY_TRANSACTIONS_TRANSACTION_DURATION})`,
  'p50(transaction.duration)': `p50(${TransactionMetric.SENTRY_TRANSACTIONS_TRANSACTION_DURATION})`,
  'p75(transaction.duration)': `p75(${TransactionMetric.SENTRY_TRANSACTIONS_TRANSACTION_DURATION})`,
  'p95(transaction.duration)': `p95(${TransactionMetric.SENTRY_TRANSACTIONS_TRANSACTION_DURATION})`,
  'p75(measurements.app_start_cold)': `p75(${TransactionMetric.SENTRY_TRANSACTIONS_MEASUREMENTS_APP_START_COLD})`,
  'p75(measurements.app_start_warm)': `p75(${TransactionMetric.SENTRY_TRANSACTIONS_MEASUREMENTS_APP_START_WARM})`,
  'p75(measurements.frames_slow_rate)': `p75(${TransactionMetric.SENTRY_TRANSACTIONS_MEASUREMENTS_FRAMES_SLOW_RATE})`,
  'p75(measurements.frames_frozen_rate)': `p75(${TransactionMetric.SENTRY_TRANSACTIONS_MEASUREMENTS_FRAMES_FROZEN_RATE})`,

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
