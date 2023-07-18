import ExternalLink from 'sentry/components/links/externalLink';
import {Layout, LayoutProps} from 'sentry/components/onboarding/gettingStartedDoc/layout';
import {ModuleProps} from 'sentry/components/onboarding/gettingStartedDoc/sdkDocumentation';
import {StepType} from 'sentry/components/onboarding/gettingStartedDoc/step';
import {t, tct} from 'sentry/locale';

// Configuration Start
const introduction = (
  <p>
    {tct(
      'The AIOHTTP integration adds support for the [link:AIOHTTP-Server Web Framework]. A Python version of 3.6 or greater is required.',
      {
        link: <ExternalLink href="https://docs.aiohttp.org/en/stable/web.html" />,
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
      {
        description: (
          <p>
            {tct(
              "If you're on Python 3.6, you also need the [code:aiocontextvars] package:",
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
    description: t('Initialize the SDK before starting the server:'),
    configurations: [
      {
        language: 'python',
        code: `
import sentry_sdk
from sentry_sdk.integrations.aiohttp import AioHttpIntegration

sentry_sdk.init(
    dsn="${dsn}",
    integrations=[
      AioHttpIntegration(),
    ],

    # Set traces_sample_rate to 1.0 to capture 100%
    # of transactions for performance monitoring.
    # We recommend adjusting this value in production,
    traces_sample_rate=1.0,
)

from aiohttp import web

async def hello(request):
    return web.Response(text="Hello, world")

app = web.Application()
app.add_routes([web.get('/', hello)])

web.run_app(app)
      `,
      },
    ],
  },
];
// Configuration End

export function GettingStartedWithAIOHTTP({dsn, ...props}: ModuleProps) {
  return <Layout steps={steps({dsn})} introduction={introduction} {...props} />;
}

export default GettingStartedWithAIOHTTP;
