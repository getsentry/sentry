import ExternalLink from 'sentry/components/links/externalLink';
import {Layout, LayoutProps} from 'sentry/components/onboarding/gettingStartedDoc/layout';
import {ModuleProps} from 'sentry/components/onboarding/gettingStartedDoc/sdkDocumentation';
import {StepType} from 'sentry/components/onboarding/gettingStartedDoc/step';
import {t, tct} from 'sentry/locale';

// Configuration Start
const introduction = (
  <p>
    {tct('The Pyramid integration adds support for the [link:Pyramid Web Framework].', {
      link: <ExternalLink href="https://trypyramid.com/" />,
    })}
  </p>
);

export const steps = ({
  sentryInitContent,
}: {
  sentryInitContent: string;
}): LayoutProps['steps'] => [
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
    description: (
      <p>
        {tct(
          'If you have the [codePyramid:pyramid] package in your dependencies, the Pyramid integration will be enabled automatically when you initialize the Sentry SDK. Initialize the Sentry SDK before your app has been initialized:',
          {
            codePyramid: <code />,
          }
        )}
      </p>
    ),
    configurations: [
      {
        language: 'python',
        code: `
from pyramid.config import Configurator
import sentry_sdk

sentry_sdk.init(
${sentryInitContent}
)

with Configurator() as config:
    # ...
      `,
      },
    ],
  },
  {
    type: StepType.VERIFY,
    description: t(
      'You can easily verify your Sentry installation by creating a view that triggers an error:'
    ),
    configurations: [
      {
        language: 'python',
        code: `from wsgiref.simple_server import make_server
from pyramid.config import Configurator
from pyramid.response import Response

sentry_sdk.init(
${sentryInitContent}
)

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
    additionalInfo: (
      <p>
        {tct(
          'When you point your browser to [link:http://localhost:6543/] an error event will be sent to Sentry.',
          {
            link: <ExternalLink href="http://localhost:6543/" />,
          }
        )}
      </p>
    ),
  },
];
// Configuration End

export function GettingStartedWithPyramid({dsn, ...props}: ModuleProps) {
  const otherConfigs: string[] = [];

  let sentryInitContent: string[] = [`    dsn="${dsn}",`];

  sentryInitContent = sentryInitContent.concat(otherConfigs);

  return (
    <Layout
      introduction={introduction}
      steps={steps({
        sentryInitContent: sentryInitContent.join('\n'),
      })}
      {...props}
    />
  );
}

export default GettingStartedWithPyramid;
