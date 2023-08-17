import ExternalLink from 'sentry/components/links/externalLink';
import {Layout, LayoutProps} from 'sentry/components/onboarding/gettingStartedDoc/layout';
import {ModuleProps} from 'sentry/components/onboarding/gettingStartedDoc/sdkDocumentation';
import {StepType} from 'sentry/components/onboarding/gettingStartedDoc/step';
import {t, tct} from 'sentry/locale';

// Configuration Start
const introduction = (
  <p>
    {tct(
      'The Pyramid integration adds support for the [link:Pyramid Web Framework]. It requires Pyramid 1.6 or later.',
      {
        link: <ExternalLink href="https://trypyramid.com/" />,
      }
    )}
  </p>
);

export const steps = ({
  dsn,
}: {
  dsn?: string;
} = {}): LayoutProps['steps'] => [
  {
    type: StepType.INSTALL,
    description: <p>{tct('Install [code:sentry-sdk] from PyPI:', {code: <code />})}</p>,
    configurations: [
      {
        language: 'bash',
        code: '$ pip install --upgrade sentry-sdk',
      },
    ],
  },
  {
    type: StepType.CONFIGURE,
    description: t(
      'To configure the SDK, initialize it with the integration before or after your app has been created:'
    ),
    configurations: [
      {
        language: 'python',
        code: `
from pyramid.config import Configurator
from wsgiref.simple_server import make_server

import sentry_sdk
from sentry_sdk.integrations.pyramid import PyramidIntegration

sentry_sdk.init(
  dsn="${dsn}",
  integrations=[
    PyramidIntegration(),
  ],

  # Set traces_sample_rate to 1.0 to capture 100%
  # of transactions for performance monitoring.
  # We recommend adjusting this value in production.
  traces_sample_rate=1.0,
)

def sentry_debug(request):
division_by_zero = 1 / 0

with Configurator() as config:
config.add_route('sentry-debug', '/')
config.add_view(sentry_debug, route_name='sentry-debug')
app = config.make_wsgi_app()
server = make_server('0.0.0.0', 6543, app)
server.serve_forever()
      `,
      },
    ],
  },
];
// Configuration End

export function GettingStartedWithPyramid({dsn, ...props}: ModuleProps) {
  return <Layout steps={steps({dsn})} introduction={introduction} {...props} />;
}

export default GettingStartedWithPyramid;
