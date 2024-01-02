import ExternalLink from 'sentry/components/links/externalLink';
import {StepType} from 'sentry/components/onboarding/gettingStartedDoc/step';
import {
  Docs,
  DocsParams,
  OnboardingConfig,
} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {getPythonMetricsOnboarding} from 'sentry/components/onboarding/gettingStartedDoc/utils/metricsOnboarding';
import replayOnboardingJsLoader from 'sentry/gettingStartedDocs/javascript/jsLoader/jsLoader';
import {t, tct} from 'sentry/locale';

type Params = DocsParams;

const getInstallSnippet = () => `pip install --upgrade sentry-sdk`;

const getSdkSetupSnippet = (params: Params) => `
from aiohttp import web

import sentry_sdk

sentry_sdk.init(
    dsn="${params.dsn}",${
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
      'The AIOHTTP integration adds support for the [link:AIOHTTP-Server Web Framework].',
      {
        link: <ExternalLink href="https://docs.aiohttp.org/en/stable/web.html" />,
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
        {
          description: tct(
            "If you're on Python 3.6, you also need the [code:aiocontextvars] package:",
            {
              code: <code />,
            }
          ),
          language: 'bash',
          code: 'pip install --upgrade aiocontextvars',
        },
      ],
    },
  ],
  configure: (params: Params) => [
    {
      type: StepType.CONFIGURE,
      description: tct(
        'If you have the [code:aiohttp] package in your dependencies, the AIOHTTO integration will be enabled automatically. There is nothing to do for you except initializing the Sentry SDK before initializing your application:',
        {
          code: <code />,
        }
      ),
      configurations: [
        {
          language: 'python',
          code: `
${getSdkSetupSnippet(params)}
async def hello(request):
   return web.Response(text="Hello, world")

app = web.Application()
app.add_routes([web.get('/', hello)])

web.run_app(app)
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

          code: `
          ${getSdkSetupSnippet(params)}
async def hello(request):
  1/0  # raises an error
  return web.Response(text="Hello, world")

app = web.Application()
app.add_routes([web.get('/', hello)])

web.run_app(app)`,
        },
      ],
      additionalInfo: (
        <span>
          <p>
            {tct(
              `When you point your browser to [localhostLInk:http://localhost:8080/] a transaction in the Performance section of Sentry will be created.`,
              {
                localhostLInk: <ExternalLink href="http://localhost:8080/" />,
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
  nextSteps: () => [],
};

const docs: Docs = {
  onboarding,
  replayOnboardingJsLoader,
  customMetricsOnboarding: getPythonMetricsOnboarding({
    installSnippet: getInstallSnippet(),
  }),
};

export default docs;
