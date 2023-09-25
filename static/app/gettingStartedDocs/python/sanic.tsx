import ExternalLink from 'sentry/components/links/externalLink';
import {Layout, LayoutProps} from 'sentry/components/onboarding/gettingStartedDoc/layout';
import {ModuleProps} from 'sentry/components/onboarding/gettingStartedDoc/sdkDocumentation';
import {StepType} from 'sentry/components/onboarding/gettingStartedDoc/step';
import {t, tct} from 'sentry/locale';

// Configuration Start
const introduction = (
  <p>
    {tct('The Sanic integration adds support for the [link:Sanic Web Framework].', {
      link: <ExternalLink href="https://github.com/sanic-org/sanic" />,
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
    description: (
      <p>
        {tct(
          'Install [sentrySdkCode:sentry-sdk] from PyPI with the [sentrySanicCode:sanic] extra:',
          {
            sentrySdkCode: <code />,
            sentrySanicCode: <code />,
          }
        )}
      </p>
    ),
    configurations: [
      {
        language: 'bash',
        code: '$ pip install --upgrade sentry-sdk[sanic]',
      },
      {
        description: (
          <p>
            {tct(
              "f you're on Python 3.6, you also need the [code:aiocontextvars] package:",
              {
                code: <code />,
              }
            )}
          </p>
        ),
        language: 'bash',
        code: '$ pip install --upgrade aiocontextvars',
      },
    ],
  },
  {
    type: StepType.CONFIGURE,
    description: (
      <p>
        {tct(
          'If you have the [codeSanic:sanic] package in your dependencies, the Sanic integration will be enabled automatically when you initialize the Sentry SDK. Initialize the Sentry SDK before your app has been initialized:',
          {
            codeSanic: <code />,
          }
        )}
      </p>
    ),
    configurations: [
      {
        language: 'python',
        code: `
from sanic import Sanic
import sentry_sdk

sentry_sdk.init(
${sentryInitContent}
)

app = Sanic(__name__)
      `,
      },
    ],
  },
  {
    type: StepType.VERIFY,
    description: t(
      'You can easily verify your Sentry installation by creating a route that triggers an error:'
    ),
    configurations: [
      {
        language: 'python',
        code: `from sanic import Sanic
from sanic.response import text

sentry_sdk.init(
${sentryInitContent}
)

app = Sanic(__name__)

@app.get("/")
async def hello_world(request):
    1 / 0  # raises an error
    return text("Hello, world.")
        `,
      },
    ],
    additionalInfo: (
      <p>
        {tct(
          'When you point your browser to [link:http://localhost:8000/] an error will be sent to Sentry.',
          {
            link: <ExternalLink href="http://localhost:8000/" />,
          }
        )}
      </p>
    ),
  },
];
// Configuration End

export function GettingStartedWithSanic({dsn, ...props}: ModuleProps) {
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

export default GettingStartedWithSanic;
