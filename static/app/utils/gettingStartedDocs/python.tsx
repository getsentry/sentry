import {ExternalLink} from 'sentry/components/core/link';
import {
  StepType,
  type ContentBlock,
  type DocsParams,
  type OnboardingConfig,
} from 'sentry/components/onboarding/gettingStartedDoc/types';
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

export function getPythonInstallCodeBlock({
  packageName = 'sentry-sdk',
  minimumVersion,
}: {
  minimumVersion?: string;
  packageName?: string;
} = {}): ContentBlock {
  const packageManagerCommands = getPythonInstallSnippet({packageName, minimumVersion});
  return {
    type: 'code',
    tabs: [
      {
        label: 'pip',
        language: 'bash',
        code: packageManagerCommands.pip,
      },
      {
        label: 'uv',
        language: 'bash',
        code: packageManagerCommands.uv,
      },
      {
        label: 'poetry',
        language: 'bash',
        code: packageManagerCommands.poetry,
      },
    ],
  };
}

export function getPythonAiocontextvarsCodeBlocks({
  description,
}: {
  description?: React.ReactNode;
} = {}): ContentBlock[] {
  const defaultDescription = tct(
    "If you're on Python 3.6, you also need the [code:aiocontextvars] package:",
    {
      code: <code />,
    }
  );

  return [
    {
      type: 'text',
      text: description ?? defaultDescription,
    },
    getPythonInstallCodeBlock({
      packageName: 'aiocontextvars',
    }),
  ];
}

export const getPythonLogsOnboarding = ({
  packageName = 'sentry-sdk',
}: {
  packageName?: string;
} = {}): OnboardingConfig => ({
  install: () => [
    {
      type: StepType.INSTALL,
      content: [
        {
          type: 'text',
          text: tct(
            'Install our Python SDK with a minimum version that supports logs ([code:2.35.0] or higher).',
            {
              code: <code />,
            }
          ),
        },
        getPythonInstallCodeBlock({
          packageName,
          minimumVersion: '2.35.0',
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
          text: tct(
            'Configure the Sentry SDK to capture logs by setting [code:enable_logs=True] in your [code:sentry_sdk.init()] call:',
            {
              code: <code />,
            }
          ),
        },
        {
          type: 'code',
          language: 'python',
          code: `import sentry_sdk

sentry_sdk.init(
    dsn="${params.dsn.public}",
    # Enable logs to be sent to Sentry
    enable_logs=True,
)`,
        },
        {
          type: 'text',
          text: tct(
            'For more detailed information on logging configuration, see the [link:logs documentation].',
            {
              link: <ExternalLink href="https://docs.sentry.io/platforms/python/logs/" />,
            }
          ),
        },
      ],
    },
  ],
  verify: (params: DocsParams) => [
    {
      type: StepType.VERIFY,
      description: t('Test that logs are working by sending some test logs:'),
      content: [getVerifyLogsContent(params)],
    },
  ],
});

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
        alternativeProfilingConfiguration(params),
      ],
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

export const alternativeProfilingConfiguration = (params: DocsParams): ContentBlock => ({
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

export const getVerifyLogsContent = (params: DocsParams): ContentBlock => ({
  type: 'conditional',
  condition: params.isLogsSelected,
  content: [
    {
      type: 'text',
      text: t('You can send logs to Sentry using the Sentry logging APIs:'),
    },
    {
      type: 'code',
      language: 'python',
      code: `import sentry_sdk

# Send logs directly to Sentry
sentry_sdk.logger.info('This is an info log message')
sentry_sdk.logger.warning('This is a warning message')
sentry_sdk.logger.error('This is an error message')`,
    },
    {
      type: 'text',
      text: t(
        "You can also use Python's built-in logging module, which will automatically forward logs to Sentry:"
      ),
    },
    {
      type: 'code',
      language: 'python',
      code: `import logging

# Your existing logging setup
logger = logging.getLogger(__name__)

# These logs will be automatically sent to Sentry
logger.info('This will be sent to Sentry')
logger.warning('User login failed')
logger.error('Something went wrong')`,
    },
  ],
});
