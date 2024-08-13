import ExternalLink from 'sentry/components/links/externalLink';
import {StepType} from 'sentry/components/onboarding/gettingStartedDoc/step';
import type {
  Docs,
  DocsParams,
  OnboardingConfig,
} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {getPythonMetricsOnboarding} from 'sentry/components/onboarding/gettingStartedDoc/utils/metricsOnboarding';
import replayOnboardingJsLoader from 'sentry/gettingStartedDocs/javascript/jsLoader/jsLoader';
import {crashReportOnboardingPython} from 'sentry/gettingStartedDocs/python/python';
import {t, tct} from 'sentry/locale';

type Params = DocsParams;

const getInstallSnippet = () => `pip install --upgrade sentry-sdk`;

const getSdkSetupSnippet = (params: Params) => `
from aiohttp import web

import sentry_sdk

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
        'If you have the [code:aiohttp] package in your dependencies, the AIOHTTO integration will be enabled automatically. You only need to ensure you initialize the Sentry SDK before initializing your application:',
        {
          code: <code />,
        }
      ),
      configurations: [
        {
          language: 'python',
          code: `
${getSdkSetupSnippet(params)}
###the following lines of code
###are for testing
async def debug(request):
   1/0  # raises an error
   return web.Response(text="Debug with Sentry")

app = web.Application()
###this one too
app.add_routes([web.get('/sentry-debug', sentry-debug)])

web.run_app(app)
        `,
        },
      ],
    },
  ],
  verify: () => [
    {
      type: StepType.VERIFY,
      description: tct(
        'You can easily verify your Sentry installation by creating a route that triggers an error. The above snippet includes an endpoint [codeDebug:GET /sentry-debug].',
        {
          codeDebug: <code />,
        }
      ),
      additionalInfo: (
        <span>
          <p>
            {tct(
              `When you point your browser to [link:http://localhost:8080/sentry-debug/] an error with a trace will be created. So you can explore errors and tracing portions of Sentry.`,
              {
                link: <ExternalLink href="http://localhost:8080/sentry-debug/" />,
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
  nextSteps: () => [],
};

const docs: Docs = {
  onboarding,
  replayOnboardingJsLoader,
  customMetricsOnboarding: getPythonMetricsOnboarding({
    installSnippet: getInstallSnippet(),
  }),
  crashReportOnboarding: crashReportOnboardingPython,
};

export default docs;
