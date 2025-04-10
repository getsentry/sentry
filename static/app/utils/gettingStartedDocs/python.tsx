import ExternalLink from 'sentry/components/links/externalLink';
import {StepType} from 'sentry/components/onboarding/gettingStartedDoc/step';
import {AlternativeConfiguration} from 'sentry/gettingStartedDocs/python/python';
import {t, tct} from 'sentry/locale';

const getProfilingInstallSnippet = (basePackage: string, minimumVersion?: string) =>
  `pip install --upgrade ${minimumVersion ? `${basePackage}>=${minimumVersion}` : basePackage}`;
import type {
  DocsParams,
  OnboardingConfig,
} from 'sentry/components/onboarding/gettingStartedDoc/types';

export const getPythonProfilingOnboarding = ({
  basePackage = 'sentry-sdk',
  traceLifecycle = 'trace',
}: {
  basePackage?: string;
  traceLifecycle?: 'manual' | 'trace';
} = {}): OnboardingConfig => ({
  install: () => [
    {
      type: StepType.INSTALL,
      description: tct(
        'To enable profiling, update the Sentry SDK to a compatible version ([code:2.24.1] or higher).',
        {
          code: <code />,
        }
      ),
      configurations: [
        {
          language: 'bash',
          code: getProfilingInstallSnippet(basePackage),
        },
      ],
    },
  ],
  configure: (params: DocsParams) => [
    {
      type: StepType.CONFIGURE,
      description: t(
        "Import and initialize the Sentry SDK early in your application's setup:"
      ),
      configurations: [
        {
          language: 'python',
          code: getProfilingSdkSetupSnippet(params, traceLifecycle),
        },
        {
          description: tct(
            'For more detailed information on profiling, see the [link:profiling documentation].',
            {
              link: (
                <ExternalLink
                  href={`https://docs.sentry.io/platforms/javascript/guides/node/profiling/node-profiling/`}
                />
              ),
            }
          ),
        },
      ],
      additionalInfo: params.isProfilingSelected &&
        params.profilingOptions?.defaultProfilingMode === 'continuous' && (
          <AlternativeConfiguration />
        ),
    },
  ],

  verify: () => [
    {
      type: StepType.VERIFY,
      description: t(
        'Verify that profiling is working correctly by simply using your application.'
      ),
    },
  ],
});

const getProfilingSdkSetupSnippet = (
  params: DocsParams,
  traceLifecycle: 'manual' | 'trace'
) => `
import sentry_sdk

sentry_sdk.init(
    dsn="${params.dsn.public}",
    # Set traces_sample_rate to 1.0 to capture 100%
    # of transactions for tracing.
    traces_sample_rate=1.0,
    ${
      params.profilingOptions?.defaultProfilingMode === 'continuous'
        ? `# Set profile_session_sample_rate to 1.0 to profile 100%
    # of profile sessions.
    profile_session_sample_rate=1.0,${
      traceLifecycle === 'trace'
        ? `
    # Set profile_lifecycle to "trace" to automatically
    # run the profiler on when there is an active transaction
    profile_lifecycle="trace",`
        : ''
    }`
        : `# Set profiles_sample_rate to 1.0 to profile 100%
    # of sampled transactions.
    # We recommend adjusting this value in production.
    profiles_sample_rate=1.0`
    }
)${
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
