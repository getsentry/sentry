import ExternalLink from 'sentry/components/links/externalLink';
import {StepType} from 'sentry/components/onboarding/gettingStartedDoc/step';
import type {
  Docs,
  DocsParams,
  OnboardingConfig,
} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {getPythonMetricsOnboarding} from 'sentry/components/onboarding/gettingStartedDoc/utils/metricsOnboarding';
import {crashReportOnboardingPython} from 'sentry/gettingStartedDocs/python/python';
import {t, tct} from 'sentry/locale';

type Params = DocsParams;

const getInstallSnippet = () => `pip install --upgrade sentry-sdk`;

const getSdkSetupSnippet = (params: Params) => `
import sentry_sdk
from sentry_sdk.integrations.asgi import SentryAsgiMiddleware

from myapp import asgi_app

sentry_sdk.init(
    dsn="${params.dsn.public}",${
      params.isPerformanceSelected
        ? `
    # Set traces_sample_rate to 1.0 to capture 100%
    # of transactions for performance monitoring.
    traces_sample_rate=1.0,`
        : ''
    }${
      params.isProfilingSelected
        ? `
    # Set profiles_sample_rate to 1.0 to profile 100%
    # of sampled transactions.
    # We recommend adjusting this value in production.
    profiles_sample_rate=1.0,`
        : ''
    }
)
`;

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
      description: tct('Wrap your ASGI application with [code: SentryAsgiMiddleware]:', {
        code: <code />,
      }),
      configurations: [
        {
          language: 'python',
          code: `
${getSdkSetupSnippet(params)}
###the following lines of code
###are for testing
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
###feel free to remove or comment out when you are done

app = SentryAsgiMiddleware(app)
    `,
        },
      ],
      additionalInfo: t('The middleware supports both ASGI 2 and ASGI 3 transparently.'),
    },
  ],
  verify: () => [
    {
      type: StepType.VERIFY,
      description: tct(
        'You can easily verify your Sentry installation with the above snippet which includes an error.',
        {
          codeDebug: <code />,
        }
      ),
      additionalInfo: (
        <span>
          <p>
            {tct(
              'Run your ASGI app with uvicorn ([code:uvicorn main:app --port 8000]) and point your browser to [link:http://localhost:8000], an error with a trace will be created. So you can explore errors and tracing portions of Sentry.',
              {
                code: <code />,
                link: <ExternalLink href="http://localhost:8000" />,
              }
            )}
          </p>
          <br />
          <p>
            {t(
              'It can take a couple of moments for the data to appear in Sentry. Bear with us, the internet is huge.'
            )}
          </p>
        </span>
      ),
    },
  ],
};

const docs: Docs = {
  onboarding,
  customMetricsOnboarding: getPythonMetricsOnboarding({
    installSnippet: getInstallSnippet(),
  }),
  crashReportOnboarding: crashReportOnboardingPython,
};

export default docs;
