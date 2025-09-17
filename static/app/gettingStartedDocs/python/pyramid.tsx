import {ExternalLink} from 'sentry/components/core/link';
import type {
  Docs,
  DocsParams,
  OnboardingConfig,
} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {StepType} from 'sentry/components/onboarding/gettingStartedDoc/types';
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
  getPythonInstallConfig,
  getPythonLogsOnboarding,
  getPythonProfilingOnboarding,
} from 'sentry/utils/gettingStartedDocs/python';

type Params = DocsParams;

const getSdkSetupSnippet = (params: Params) => `
from pyramid.config import Configurator
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
    }
)
`;

const onboarding: OnboardingConfig = {
  introduction: () =>
    tct('The Pyramid integration adds support for the [link:Pyramid Web Framework].', {
      link: <ExternalLink href="https://trypyramid.com/" />,
    }),
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
      description: tct(
        'If you have the [codePyramid:pyramid] package in your dependencies, the Pyramid integration will be enabled automatically when you initialize the Sentry SDK. Initialize the Sentry SDK before your app has been initialized:',
        {
          codePyramid: <code />,
        }
      ),
      configurations: [
        {
          language: 'python',
          code: `
${getSdkSetupSnippet(params)}
with Configurator() as config:
    # ...
        `,
        },
      ],
    },
  ],
  verify: (params: Params) => [
    {
      type: StepType.VERIFY,
      description: t(
        'You can easily verify your Sentry installation by creating a route that triggers an error:'
      ),
      configurations: [
        {
          language: 'python',

          code: `from wsgiref.simple_server import make_server
from pyramid.response import Response${getSdkSetupSnippet(params)}
def hello_world(request):
    1/0  # raises an error
    return Response('Hello World!')

if __name__ == '__main__':
    with Configurator() as config:
        config.add_route('hello', '/')
        config.add_view(hello_world, route_name='hello')
        app = config.make_wsgi_app()

    server = make_server('0.0.0.0', 6543, app)
    server.serve_forever()
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
      additionalInfo: tct(
        'When you point your browser to [link:http://localhost:6543/] an error event will be sent to Sentry.',
        {
          link: <ExternalLink href="http://localhost:6543/" />,
        }
      ),
    },
  ],
  nextSteps: (params: Params) => {
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

const logsOnboarding = getPythonLogsOnboarding();

const docs: Docs = {
  onboarding,
  replayOnboardingJsLoader,
  crashReportOnboarding: crashReportOnboardingPython,
  featureFlagOnboarding,
  feedbackOnboardingJsLoader,
  profilingOnboarding: getPythonProfilingOnboarding(),
  agentMonitoringOnboarding,
  logsOnboarding,
};

export default docs;
