import {Fragment} from 'react';

import {ExternalLink} from 'sentry/components/core/link';
import {
  StepType,
  type Docs,
  type DocsParams,
  type OnboardingConfig,
} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {
  agentMonitoringOnboarding,
  crashReportOnboardingPython,
} from 'sentry/gettingStartedDocs/python/python';
import {t, tct} from 'sentry/locale';
import {
  AlternativeConfiguration,
  getPythonInstallConfig,
  getPythonLogsOnboarding,
  getPythonProfilingOnboarding,
} from 'sentry/utils/gettingStartedDocs/python';

type Params = DocsParams;

const getSdkSetupSnippet = (params: Params) => `
import sentry_sdk
from sentry_sdk.integrations.asgi import SentryAsgiMiddleware

from myapp import asgi_app

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

asgi_app = SentryAsgiMiddleware(asgi_app)`;

const getVerifySnippet = () => `
import sentry_sdk
from sentry_sdk.integrations.asgi import SentryAsgiMiddleware

from myapp import asgi_app
sentry_sdk.init(...) # same as above

def app(scope):
    async def get_body():
        return f"The number is: {1/0}" # raises an error!

    async def asgi(receive, send):
        await send(
            {
                "type": "http.response.start",
                "status": 200,
                "headers": [[b"content-type", b"text/plain"]],
            }
        )
        await send({"type": "http.response.body", "body": await get_body()})

    return asgi

app = SentryAsgiMiddleware(app)`;

const onboarding: OnboardingConfig = {
  introduction: () =>
    tct(
      'The ASGI middleware can be used to instrument any bare bones ASGI application. If you have a ASGI based web framework (like FastAPI, Starlette, or others), please use the specific integration for the framework.',
      {
        link: <ExternalLink href="https://asgi.readthedocs.io/en/latest/" />,
      }
    ),
  install: () => [
    {
      type: StepType.INSTALL,
      description: tct('Install [code:sentry-sdk] from PyPI:', {
        code: <code />,
      }),
      configurations: getPythonInstallConfig(),
    },
  ],

  configure: (params: Params) => [
    {
      type: StepType.CONFIGURE,
      description: tct('Wrap your ASGI application with [code: SentryAsgiMiddleware]:', {
        code: <code />,
      }),
      configurations: [
        {
          language: 'python',
          code: getSdkSetupSnippet(params),
        },
      ],
      additionalInfo: (
        <Fragment>
          {params.isProfilingSelected &&
            params.profilingOptions?.defaultProfilingMode === 'continuous' && (
              <Fragment>
                <AlternativeConfiguration />
                <br />
              </Fragment>
            )}
          {t('The middleware supports both ASGI 2 and ASGI 3 transparently.')}
        </Fragment>
      ),
    },
  ],
  verify: (params: Params) => [
    {
      type: StepType.VERIFY,
      description: t('To verify that everything is working trigger an error on purpose:'),
      configurations: [
        {
          language: 'python',
          code: getVerifySnippet(),
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
              'Run your ASGI app with uvicorn ([code:uvicorn main:app --port 8000]) and point your browser to [link:http://localhost:8000]. A transaction in the Performance section of Sentry will be created.',
              {
                code: <code />,
                link: <ExternalLink href="http://localhost:8000" />,
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
  crashReportOnboarding: crashReportOnboardingPython,
  profilingOnboarding: getPythonProfilingOnboarding(),
  agentMonitoringOnboarding,
  logsOnboarding,
};

export default docs;
