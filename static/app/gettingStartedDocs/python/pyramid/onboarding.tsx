import {ExternalLink} from 'sentry/components/core/link';
import {
  StepType,
  type DocsParams,
  type OnboardingConfig,
} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {logsVerify} from 'sentry/gettingStartedDocs/python/python/logs';
import {metricsVerify} from 'sentry/gettingStartedDocs/python/python/metrics';
import {getPythonInstallCodeBlock} from 'sentry/gettingStartedDocs/python/python/utils';
import {t, tct} from 'sentry/locale';

const getSdkSetupSnippet = (params: DocsParams) => `
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

export const onboarding: OnboardingConfig = {
  introduction: () =>
    tct('The Pyramid integration adds support for the [link:Pyramid Web Framework].', {
      link: <ExternalLink href="https://trypyramid.com/" />,
    }),
  install: () => [
    {
      type: StepType.INSTALL,
      content: [
        {
          type: 'text',
          text: tct('Install [code:sentry-sdk] from PyPI:', {
            code: <code />,
          }),
        },
        getPythonInstallCodeBlock(),
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
            'If you have the [codePyramid:pyramid] package in your dependencies, the Pyramid integration will be enabled automatically when you initialize the Sentry SDK. Initialize the Sentry SDK before your app has been initialized:',
            {
              codePyramid: <code />,
            }
          ),
        },
        {
          type: 'code',
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
  verify: (params: DocsParams) => [
    {
      type: StepType.VERIFY,
      content: [
        {
          type: 'text',
          text: t(
            'You can easily verify your Sentry installation by creating a route that triggers an error:'
          ),
        },
        {
          type: 'code',
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
        logsVerify(params),
        metricsVerify(params),
        {
          type: 'text',
          text: tct(
            'When you point your browser to [link:http://localhost:6543/] an error event will be sent to Sentry.',
            {
              link: <ExternalLink href="http://localhost:6543/" />,
            }
          ),
        },
      ],
    },
  ],
  nextSteps: (params: DocsParams) => {
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
