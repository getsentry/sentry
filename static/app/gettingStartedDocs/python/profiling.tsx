import {ExternalLink} from 'sentry/components/core/link';
import {
  StepType,
  type ContentBlock,
  type DocsParams,
  type OnboardingConfig,
} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {t, tct} from 'sentry/locale';

import {getPythonInstallCodeBlock} from './utils';

const getProfilingSdkSetupSnippet = (
  params: DocsParams,
  traceLifecycle: 'manual' | 'trace'
) => `
import sentry_sdk

sentry_sdk.init(
    dsn="${params.dsn.public}",${
      params.profilingOptions?.defaultProfilingMode === 'continuous'
        ? traceLifecycle === 'trace'
          ? `
    # Set traces_sample_rate to 1.0 to capture 100%
    # of transactions for tracing.
    traces_sample_rate=1.0,
    # Set profile_session_sample_rate to 1.0 to profile 100%
    # of profile sessions.
    profile_session_sample_rate=1.0,
    # Set profile_lifecycle to "trace" to automatically
    # run the profiler on when there is an active transaction
    profile_lifecycle="trace"`
          : `
    # Tracing is not required for profiling to work
    # but for the best experience we recommend enabling it
    traces_sample_rate=1.0,
    # Set profile_session_sample_rate to 1.0 to profile 100%
    # of profile sessions.
    profile_session_sample_rate=1.0`
        : `
    # Set traces_sample_rate to 1.0 to capture 100%
    # of transactions for tracing.
    traces_sample_rate=1.0,
    # Set profiles_sample_rate to 1.0 to profile 100%
    # of sampled transactions.
    # We recommend adjusting this value in production.
    profiles_sample_rate=1.0`
    }
)${
  params.profilingOptions?.defaultProfilingMode === 'continuous' &&
  traceLifecycle === 'manual'
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

export const alternativeProfiling = (params: DocsParams): ContentBlock => ({
  type: 'conditional',
  condition:
    params.isProfilingSelected &&
    params.profilingOptions?.defaultProfilingMode === 'continuous',
  content: [
    {
      type: 'text',
      text: tct(
        'Alternatively, you can also explicitly control continuous profiling or use transaction profiling. See our [link:documentation] for more information.',
        {
          link: (
            <ExternalLink href="https://docs.sentry.io/platforms/python/profiling/" />
          ),
        }
      ),
    },
  ],
});

export const profiling = ({
  basePackage = 'sentry-sdk',
  traceLifecycle = 'trace',
}: {
  basePackage?: string;
  traceLifecycle?: 'manual' | 'trace';
} = {}): OnboardingConfig => ({
  install: () => [
    {
      type: StepType.INSTALL,
      content: [
        {
          type: 'text',
          text: tct(
            'To enable profiling, update the Sentry SDK to a compatible version ([code:2.24.1] or higher).',
            {
              code: <code />,
            }
          ),
        },
        getPythonInstallCodeBlock({
          packageName: basePackage,
          minimumVersion: '2.24.1',
        }),
      ],
    },
  ],
  configure: (params: DocsParams) => [
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
          code: getProfilingSdkSetupSnippet(params, traceLifecycle),
        },
        {
          type: 'text',
          text: tct(
            'For more detailed information on profiling, see the [link:profiling documentation].',
            {
              link: (
                <ExternalLink href="https://docs.sentry.io/platforms/python/profiling/" />
              ),
            }
          ),
        },
        alternativeProfiling(params),
      ],
    },
  ],
  verify: () => [
    {
      type: StepType.VERIFY,
      content: [
        {
          type: 'text',
          text: t(
            'Verify that profiling is working correctly by simply using your application.'
          ),
        },
      ],
    },
  ],
});
