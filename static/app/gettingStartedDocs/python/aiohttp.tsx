import {ExternalLink} from 'sentry/components/core/link';
import {
  StepType,
  type Docs,
  type DocsParams,
  type OnboardingConfig,
} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {
  feedbackOnboardingJsLoader,
  replayOnboardingJsLoader,
} from 'sentry/gettingStartedDocs/javascript/jsLoader/jsLoader';
import {
  agentMonitoringOnboarding,
  crashReportOnboardingPython,
  featureFlagOnboarding,
} from 'sentry/gettingStartedDocs/python/python';
import {t, tct} from 'sentry/locale';
import {
  AlternativeConfiguration,
  getPythonAiocontextvarsConfig,
  getPythonInstallConfig,
  getPythonLogsOnboarding,
  getPythonProfilingOnboarding,
} from 'sentry/utils/gettingStartedDocs/python';

type Params = DocsParams;

const getSdkSetupSnippet = (params: Params) => `
from aiohttp import web

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
    profile_session_sample_rate=1.0,
    # Set profile_lifecycle to "trace" to automatically
    # run the profiler on when there is an active transaction
    profile_lifecycle="trace",`
          : ''
    }
)
`;

const onboarding: OnboardingConfig = {
  introduction: () =>
    tct(
      'The AIOHTTP integration adds support for the [link:AIOHTTP-Server Web Framework].',
      {
        link: <ExternalLink href="https://docs.aiohttp.org/en/stable/web.html" />,
      }
    ),
  install: () => [
    {
      type: StepType.INSTALL,
      description: tct('Install [code:sentry-sdk] from PyPI:', {
        code: <code />,
      }),
      configurations: [...getPythonInstallConfig(), ...getPythonAiocontextvarsConfig()],
    },
  ],
  configure: (params: Params) => [
    {
      type: StepType.CONFIGURE,
      description: tct(
        'If you have the [code:aiohttp] package in your dependencies, the AIOHTTO integration will be enabled automatically. There is nothing to do for you except initializing the Sentry SDK before initializing your application:',
        {
          code: <code />,
        }
      ),
      configurations: [
        {
          language: 'python',
          code: getSdkSetupSnippet(params),
        },
      ],
      additionalInfo: params.isProfilingSelected &&
        params.profilingOptions?.defaultProfilingMode === 'continuous' && (
          <AlternativeConfiguration />
        ),
    },
  ],
  verify: (params: Params) => [
    {
      type: StepType.VERIFY,
      configurations: [
        {
          description: t(
            'You can easily verify your Sentry installation by creating a route that triggers an error:'
          ),
          language: 'python',
          code: `
async def hello(request):
    1/0  # raises an error
    return web.Response(text="Hello, world")

app = web.Application()
app.add_routes([web.get('/', hello)])

web.run_app(app)
`,
        },
        ...(params.isLogsSelected
          ? [
              {
                description: t(
                  'You can send logs to Sentry using the Sentry logging APIs:'
                ),
                language: 'python',
                code: `import sentry_sdk

# Send logs directly to Sentry
sentry_sdk.logger.info('This is an info log message')
sentry_sdk.logger.warning('This is a warning message')
sentry_sdk.logger.error('This is an error message')`,
              },
              {
                description: t(
                  "You can also use Python's built-in logging module, which will automatically forward logs to Sentry:"
                ),
                language: 'python',
                code: `import logging

# Your existing logging setup
logger = logging.getLogger(__name__)

# These logs will be automatically sent to Sentry
logger.info('This will be sent to Sentry')
logger.warning('User login failed')
logger.error('Something went wrong')`,
              },
            ]
          : []),
      ],
      additionalInfo: (
        <span>
          <p>
            {tct(
              `When you point your browser to [localhostLInk:http://localhost:8080/] a transaction in the Performance section of Sentry will be created.`,
              {
                localhostLInk: <ExternalLink href="http://localhost:8080/" />,
              }
            )}
          </p>
          <p>
            {t(
              'Additionally, an error event will be sent to Sentry and will be connected to the transaction.'
            )}
          </p>
          <p>{t('It takes a couple of moments for the data to appear in Sentry.')}</p>
        </span>
      ),
    },
  ],
  nextSteps: (params: Params) => {
    const steps = [] as any[];
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

const logsOnboarding = getPythonLogsOnboarding();

const docs: Docs = {
  onboarding,
  replayOnboardingJsLoader,
  profilingOnboarding: getPythonProfilingOnboarding(),
  crashReportOnboarding: crashReportOnboardingPython,
  featureFlagOnboarding,
  feedbackOnboardingJsLoader,
  agentMonitoringOnboarding,
  logsOnboarding,
};

export default docs;
