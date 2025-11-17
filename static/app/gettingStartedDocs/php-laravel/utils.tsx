import type {DocsParams} from 'sentry/components/onboarding/gettingStartedDoc/types';

export const getConfigureSnippet = (params: DocsParams) =>
  `SENTRY_LARAVEL_DSN=${params.dsn.public}${
    params.isPerformanceSelected
      ? `
# Specify a fixed sample rate
SENTRY_TRACES_SAMPLE_RATE=1.0`
      : ''
  }${
    params.isProfilingSelected
      ? `
# Set a sampling rate for profiling - this is relative to traces_sample_rate
SENTRY_PROFILES_SAMPLE_RATE=1.0`
      : ''
  }${
    params.isLogsSelected
      ? `
# Enable logs to be sent to Sentry
SENTRY_ENABLE_LOGS=true
# Configure logging to use both file and Sentry
LOG_CHANNEL=stack
LOG_STACK=single,sentry_logs`
      : ''
  }`;
