import {BadgeType} from 'sentry/components/featureBadge';

export const RELEASE_LEVEL: BadgeType = 'new';

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
