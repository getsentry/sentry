import {ExternalLink} from 'sentry/components/core/link';
import {
  type Configuration,
  StepType,
} from 'sentry/components/onboarding/gettingStartedDoc/step';
import type {
  DocsParams,
  OnboardingConfig,
} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {AlternativeConfiguration} from 'sentry/gettingStartedDocs/python/python';
import {t, tct} from 'sentry/locale';

function getPythonInstallSnippet({
  packageName,
  minimumVersion,
}: {
  packageName: string;
  minimumVersion?: string;
}) {
  // We are using consistent double quotes here for all package managers after aligning with the Python SDK team.
  // Not using quotes may lead to some shells interpreting the square brackets, and using double quotes over single quotes is a convention.
  const versionedPackage = minimumVersion
    ? `"${packageName}>=${minimumVersion}"`
    : `"${packageName}"`;

  const upgradeFlag = minimumVersion ? '--upgrade ' : '';

  const packageManagerCommands = {
    uv: `uv add ${upgradeFlag}${versionedPackage}`,
    pip: `pip install ${upgradeFlag}${versionedPackage}`,
    poetry: `poetry add ${versionedPackage}`,
  };

  return packageManagerCommands;
}

export function getPythonInstallConfig({
  packageName = 'sentry-sdk',
  description,
  minimumVersion,
}: {
  description?: React.ReactNode;
  minimumVersion?: string;
  packageName?: string;
} = {}): Configuration[] {
  const packageManagerCommands = getPythonInstallSnippet({packageName, minimumVersion});
  return [
    {
      description,
      language: 'bash',
      code: [
        {
          label: 'pip',
          value: 'pip',
          language: 'bash',
          code: packageManagerCommands.pip,
        },
        {
          label: 'uv',
          value: 'uv',
          language: 'bash',
          code: packageManagerCommands.uv,
        },
        {
          label: 'poetry',
          value: 'poetry',
          language: 'bash',
          code: packageManagerCommands.poetry,
        },
      ],
    },
  ];
}

export function getPythonAiocontextvarsConfig({
  description,
}: {
  description?: React.ReactNode;
} = {}): Configuration[] {
  const defaultDescription = tct(
    "If you're on Python 3.6, you also need the [code:aiocontextvars] package:",
    {
      code: <code />,
    }
  );

  return getPythonInstallConfig({
    packageName: 'aiocontextvars',
    description: description ?? defaultDescription,
  });
}

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
      configurations: getPythonInstallConfig({
        packageName: basePackage,
        minimumVersion: '2.24.1',
      }),
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
