import {ColumnType} from '../discover/fields';

export enum SessionMetric {
  SESSION = 'sentry.sessions.session',
  SESSION_DURATION = 'sentry.sessions.session.duration',
  SESSION_ERROR = 'sentry.sessions.session.error',
  USER = 'sentry.sessions.user',
  TRANSACTION_DURATION = 'sentry.sessions.transaction.duration',
}

export enum MeasurementMetric {
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
}

export const METRICS: Readonly<Record<SessionMetric | MeasurementMetric, ColumnType>> = {
  // Session metrics
  [SessionMetric.TRANSACTION_DURATION]: 'duration',
  [SessionMetric.USER]: 'integer',
  [SessionMetric.SESSION_ERROR]: 'integer',
  [SessionMetric.SESSION_DURATION]: 'duration',
  [SessionMetric.SESSION]: 'duration',

  // Measurement metrics
  [MeasurementMetric.MEASUREMENTS_FP]: 'duration',
  [MeasurementMetric.MEASUREMENTS_FCP]: 'duration',
  [MeasurementMetric.MEASUREMENTS_LCP]: 'duration',
  [MeasurementMetric.MEASUREMENTS_FID]: 'duration',
  [MeasurementMetric.MEASUREMENTS_CLS]: 'number',
  [MeasurementMetric.MEASUREMENTS_TTFB]: 'duration',
  [MeasurementMetric.MEASUREMENTS_TTFB_REQUESTTIME]: 'duration',
  [MeasurementMetric.MEASUREMENTS_APP_START_COLD]: 'duration',
  [MeasurementMetric.MEASUREMENTS_APP_START_WARM]: 'duration',
  [MeasurementMetric.MEASUREMENTS_FRAMES_TOTAL]: 'integer',
  [MeasurementMetric.MEASUREMENTS_FRAMES_SLOW]: 'integer',
  [MeasurementMetric.MEASUREMENTS_FRAMES_FROZEN]: 'integer',
  [MeasurementMetric.MEASUREMENTS_FRAMES_SLOW_RATE]: 'percentage',
  [MeasurementMetric.MEASUREMENTS_FRAMES_FROZEN_RATE]: 'percentage',
  [MeasurementMetric.MEASUREMENTS_STALL_COUNT]: 'integer',
  [MeasurementMetric.MEASUREMENTS_STALL_TOTAL_TIME]: 'duration',
  [MeasurementMetric.MEASUREMENTS_STALL_LONGEST_TIME]: 'duration',
  [MeasurementMetric.MEASUREMENTS_STALL_PERCENTAGE]: 'percentage',
};
