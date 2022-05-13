import {MetricsOperation, MetricsType} from 'sentry/types';

import {ColumnType} from '../discover/fields';

export enum SessionMetric {
  SESSION = 'sentry.sessions.session',
  SESSION_DURATION = 'sentry.sessions.session.duration',
  SESSION_ERROR = 'sentry.sessions.session.error',
  SESSION_CRASH_FREE_RATE = 'session.crash_free_rate',
  USER_CRASH_FREE_RATE = 'session.crash_free_user_rate',
  SESSION_CRASH_RATE = 'session.crash_rate',
  USER_CRASH_RATE = 'session.crash_user_rate',
  USER = 'sentry.sessions.user',
  SESSION_HEALTHY = 'session.healthy',
  USER_HEALTHY = 'session.healthy_user',
  SESSION_ABNORMAL = 'session.abnormal',
  USER_ABNORMAL = 'session.abnormal_user',
  SESSION_CRASHED = 'session.crashed',
  USER_CRASHED = 'session.crashed_user',
  SESSION_ERRORED = 'session.errored',
  USER_ERRORED = 'session.errored_user',
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
  [SessionMetric.SESSION_CRASH_FREE_RATE]: 'percentage',
  [SessionMetric.USER_CRASH_FREE_RATE]: 'percentage',
  [SessionMetric.SESSION_CRASH_RATE]: 'percentage',
  [SessionMetric.USER_CRASH_RATE]: 'percentage',
  [SessionMetric.SESSION_HEALTHY]: 'integer',
  [SessionMetric.USER_HEALTHY]: 'integer',
  [SessionMetric.SESSION_ABNORMAL]: 'integer',
  [SessionMetric.USER_ABNORMAL]: 'integer',
  [SessionMetric.SESSION_CRASHED]: 'integer',
  [SessionMetric.USER_CRASHED]: 'integer',
  [SessionMetric.SESSION_ERRORED]: 'integer',
  [SessionMetric.USER_ERRORED]: 'integer',

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
