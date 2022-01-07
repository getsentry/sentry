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
}

export const METRIC_TO_COLUMN_TYPE: Readonly<
  Record<SessionMetric | TransactionMetric, ColumnType>
> = {
  // Session metrics
  [SessionMetric.SENTRY_SESSIONS_USER]: 'integer',
  [SessionMetric.SENTRY_SESSIONS_SESSION_ERROR]: 'integer',
  [SessionMetric.SENTRY_SESSIONS_SESSION_DURATION]: 'duration',
  [SessionMetric.SENTRY_SESSIONS_SESSION]: 'duration',

  // Measurement metrics
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

export const DISCOVER_FIELD_TO_METRIC = {
  'tpm()': `count(${TransactionMetric.SENTRY_TRANSACTIONS_TRANSACTION_DURATION})`,
  'apdex()': undefined, // TODO(metrics): not yet supported by API
  'p50(transaction.duration)': `p50(${TransactionMetric.SENTRY_TRANSACTIONS_TRANSACTION_DURATION})`,
  'p75(transaction.duration)': `p75(${TransactionMetric.SENTRY_TRANSACTIONS_TRANSACTION_DURATION})`,
  'p95(transaction.duration)': `p95(${TransactionMetric.SENTRY_TRANSACTIONS_TRANSACTION_DURATION})`,
  'p99(transaction.duration)': `p99(${TransactionMetric.SENTRY_TRANSACTIONS_TRANSACTION_DURATION})`,
  'p75(measurements.lcp)': `p75(${TransactionMetric.SENTRY_TRANSACTIONS_MEASUREMENTS_LCP})`,
  'failure_rate()': `count(${TransactionMetric.SENTRY_TRANSACTIONS_TRANSACTION_DURATION})`, // TODO(metrics): failure_rate alias not yet supported by API, we can get rate like this, but it needs to be coupled with failed status filter
  'user_misery()': undefined, // TODO(metrics): not yet supported by API
  'p75(measurements.app_start_cold)': `p75(${TransactionMetric.SENTRY_TRANSACTIONS_MEASUREMENTS_APP_START_COLD})`,
  'p75(measurements.app_start_warm)': `p75(${TransactionMetric.SENTRY_TRANSACTIONS_MEASUREMENTS_APP_START_WARM})`,
  'p75(measurements.frames_slow_rate)': `p75(${TransactionMetric.SENTRY_TRANSACTIONS_MEASUREMENTS_FRAMES_SLOW_RATE})`,
  'p75(measurements.frames_frozen_rate)': `p75(${TransactionMetric.SENTRY_TRANSACTIONS_MEASUREMENTS_FRAMES_FROZEN_RATE})`,
};

export const METRIC_TO_DISCOVER_FIELD = invert(DISCOVER_FIELD_TO_METRIC);
