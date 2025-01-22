import ExternalLink from 'sentry/components/links/externalLink';
import {StepType} from 'sentry/components/onboarding/gettingStartedDoc/step';
import type {
  Docs,
  DocsParams,
  OnboardingConfig,
} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {
  feedbackOnboardingJsLoader,
  replayOnboardingJsLoader,
} from 'sentry/gettingStartedDocs/javascript/jsLoader/jsLoader';
import {
  crashReportOnboardingPython,
  featureFlagOnboarding,
} from 'sentry/gettingStartedDocs/python/python';
import {t, tct} from 'sentry/locale';

type Params = DocsParams;

const getInstallSnippet = () => `pip install --upgrade sentry-sdk`;

const getSdkSetupSnippet = (params: Params) => `
from pyramid.config import Configurator
import sentry_sdk

sentry_sdk.init(
    dsn="${params.dsn.public}",
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
      description: tct('Install [code:sentry-sdk] from PyPI:', {code: <code />}),
      configurations: [
        {
          language: 'bash',
          code: getInstallSnippet(),
        },
      ],
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
      ],
      additionalInfo: tct(
        'When you point your browser to [link:http://localhost:6543/] an error event will be sent to Sentry.',
        {
          link: <ExternalLink href="http://localhost:6543/" />,
        }
      ),
    },
  ],
  nextSteps: () => [],
};

const docs: Docs = {
  onboarding,
  replayOnboardingJsLoader,

  crashReportOnboarding: crashReportOnboardingPython,
  featureFlagOnboarding,
  feedbackOnboardingJsLoader,
};

export default docs;
