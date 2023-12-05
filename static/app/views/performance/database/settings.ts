import {
  FORTY_EIGHT_HOURS,
  GranularityLadder,
  ONE_HOUR,
  SIX_HOURS,
  SIXTY_DAYS,
  THIRTY_DAYS,
  TWENTY_FOUR_HOURS,
  TWO_WEEKS,
} from 'sentry/components/charts/utils';

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

export const DEFAULT_INTERVAL = '10m';

export const DEFAULT_DURATION_AGGREGATE = 'avg';

export const CHART_HEIGHT = 160;

export const COUNTER_GRANULARITIES = new GranularityLadder([
  [SIXTY_DAYS, '1d'],
  [THIRTY_DAYS, '12h'],
  [TWO_WEEKS, '4h'],
  [TWENTY_FOUR_HOURS, '30m'],
  [SIX_HOURS, '5m'],
  [ONE_HOUR, '1m'],
  [0, '1m'],
]);

export const DISTRIBUTION_GRANULARITIES = new GranularityLadder([
  [TWO_WEEKS, '1d'],
  [FORTY_EIGHT_HOURS, '1h'],
  [TWENTY_FOUR_HOURS, '30m'],
  [SIX_HOURS, '5m'],
  [ONE_HOUR, '1m'],
  [0, '1m'],
]);
