import ExternalLink from 'sentry/components/links/externalLink';
import {Layout, LayoutProps} from 'sentry/components/onboarding/gettingStartedDoc/layout';
import {ModuleProps} from 'sentry/components/onboarding/gettingStartedDoc/sdkDocumentation';
import {StepType} from 'sentry/components/onboarding/gettingStartedDoc/step';
import {ProductSolution} from 'sentry/components/onboarding/productSelection';
import {t, tct} from 'sentry/locale';

// Configuration Start
const performanceConfiguration = `    # Set traces_sample_rate to 1.0 to capture 100%
    # of transactions for performance monitoring.
    traces_sample_rate=1.0,`;

const introduction = (
  <p>
    {tct(
      'The ASGI middleware can be used to instrument any bare bones ASGI application. If you have a ASGI based web framework (like FastAPI, Starlette, or others), please use the specific integration for the framework.',
      {
        link: <ExternalLink href="https://asgi.readthedocs.io/en/latest/" />,
      }
    )}
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
        {tct('Install [code:sentry-sdk] from PyPI:', {
          code: <code />,
        })}
      </p>
    ),
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
        {tct('Wrap your ASGI application with [code: SentryAsgiMiddleware]:', {
          code: <code />,
        })}
      </p>
    ),
    configurations: [
      {
        language: 'python',
        code: `
import sentry_sdk
from sentry_sdk.integrations.asgi import SentryAsgiMiddleware

from myapp import asgi_app

sentry_sdk.init(
${sentryInitContent}
)

asgi_app = SentryAsgiMiddleware(asgi_app)
        `,
      },
    ],
    additionalInfo: t('The middleware supports both ASGI 2 and ASGI 3 transparently.'),
  },
  {
    type: StepType.VERIFY,
    description: (
      <p>{t('To verify that everything is working trigger an error on purpose:')}</p>
    ),
    configurations: [
      {
        language: 'python',
        code: `sentry_sdk.init(
${sentryInitContent}
)

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

app = SentryAsgiMiddleware(app)
      `,
      },
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
];
// Configuration End

export function GettingStartedWithASGI({
  dsn,
  activeProductSelection = [],
  ...props
}: ModuleProps) {
  const otherConfigs: string[] = [];

  let sentryInitContent: string[] = [`    dsn="${dsn}",`];

  if (activeProductSelection.includes(ProductSolution.PERFORMANCE_MONITORING)) {
    otherConfigs.push(performanceConfiguration);
  }

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

export default GettingStartedWithASGI;
