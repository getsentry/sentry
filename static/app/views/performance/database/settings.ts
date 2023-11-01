import {t} from 'sentry/locale';

export const MIN_SDK_VERSION_BY_PLATFORM: {[platform: string]: string} = {
  'sentry.python': '1.29.2',
  'sentry.javascript': '7.63.0',
  'sentry.laravel': '3.8.0',
  'sentry.cocoa': '8.11.0',
  'sentry.java': '6.29.0',
  'sentry.ruby': '5.11.0',
  'sentry.dotnet': '3.39.0',
  'sentry.symfony': '4.11.0',
  'sentry.android': '6.30.0',
};

export const DEFAULT_DURATION_AGGREGATE = 'avg';

export const AVAILABLE_DURATION_AGGREGATES = ['avg', 'p50', 'p75', 'p95', 'p99'];

export const DURATION_AGGREGATE_LABELS = {
  avg: t('Average Duration'),
  p50: t('Duration p50'),
  p75: t('Duration p75'),
  p95: t('Duration p95'),
  p99: t('Duration p99'),
};

export const AVAILABLE_DURATION_AGGREGATE_OPTIONS = AVAILABLE_DURATION_AGGREGATES.map(
  aggregate => ({
    value: aggregate,
    label: DURATION_AGGREGATE_LABELS[aggregate],
  })
);
