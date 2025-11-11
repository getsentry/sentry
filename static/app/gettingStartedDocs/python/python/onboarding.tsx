import type {
  DocsParams,
  OnboardingConfig,
} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {StepType} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {t, tct} from 'sentry/locale';

import {logsVerify} from './logs';
import {metricsVerify} from './metrics';
import {alternativeProfiling} from './profiling';
import {getPythonInstallCodeBlock} from './utils';

const getSdkSetupSnippet = (params: DocsParams) => `
import sentry_sdk

sentry_sdk.init(
    dsn="${params.dsn.public}",
    # Add data like request headers and IP for users,
    # see https://docs.sentry.io/platforms/python/data-management/data-collected/ for more info
    send_default_pii=True,${
      params.isLogsSelected
        ? `
    # Enable sending logs to Sentry
    enable_logs=True,`
        : ''
    }${
      params.isPerformanceSelected
        ? `
    # Set traces_sample_rate to 1.0 to capture 100%
    # of transactions for tracing.
    traces_sample_rate=1.0,`
        : ''
    }${
      params.isProfilingSelected &&
      params.profilingOptions?.defaultProfilingMode !== 'continuous'
        ? `
    # Set profiles_sample_rate to 1.0 to profile 100%
    # of sampled transactions.
    # We recommend adjusting this value in production.
    profiles_sample_rate=1.0,`
        : params.isProfilingSelected &&
            params.profilingOptions?.defaultProfilingMode === 'continuous'
          ? `
    # Set profile_session_sample_rate to 1.0 to profile 100%
    # of profile sessions.
    profile_session_sample_rate=1.0,`
          : ''
    }
)${
  params.isProfilingSelected &&
  params.profilingOptions?.defaultProfilingMode === 'continuous'
    ? `

def slow_function():
    import time
    time.sleep(0.1)
    return "done"

def fast_function():
    import time
    time.sleep(0.05)
    return "done"

# Manually call start_profiler and stop_profiler
# to profile the code in between
sentry_sdk.profiler.start_profiler()

for i in range(0, 10):
    slow_function()
    fast_function()

# Calls to stop_profiler are optional - if you don't stop the profiler, it will keep profiling
# your application until the process exits or stop_profiler is called.
sentry_sdk.profiler.stop_profiler()`
    : ''
}`;

export const onboarding: OnboardingConfig = {
  install: () => [
    {
      type: StepType.INSTALL,
      content: [
        {
          type: 'text',
          text: tct('Install our Python SDK:', {
            code: <code />,
          }),
        },
        getPythonInstallCodeBlock(),
      ],
    },
  ],
  configure: params => [
    {
      type: StepType.CONFIGURE,
      content: [
        {
          type: 'text',
          text: t(
            "Import and initialize the Sentry SDK early in your application's setup:"
          ),
        },
        {
          type: 'code',
          language: 'python',
          code: getSdkSetupSnippet(params),
        },
        alternativeProfiling(params),
      ],
    },
  ],
  verify: params => [
    {
      type: StepType.VERIFY,
      content: [
        {
          type: 'text',
          text: t(
            'You can verify your setup by intentionally causing an error that breaks your application:'
          ),
        },
        {
          type: 'code',
          language: 'python',
          code: 'division_by_zero = 1 / 0',
        },
        logsVerify(params),
        metricsVerify(params),
      ],
    },
  ],
  nextSteps: params => {
    const steps = [];

    if (params.isLogsSelected) {
      steps.push({
        id: 'logs',
        name: t('Logging Integrations'),
        description: t(
          'Add logging integrations to automatically capture logs from your application.'
        ),
        link: 'https://docs.sentry.io/platforms/python/logs/#integrations',
      });
    }

    return steps;
  },
};
