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

const getSdkSetupSnippet = (params: Params) => `import sentry_sdk

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
    tct('The Tornado integration adds support for the [link:Tornado Web Framework].', {
      link: <ExternalLink href="https://www.tornadoweb.org/en/stable/" />,
    }),
  install: () => [
    {
      type: StepType.INSTALL,
      description: tct(
        'Install [sentrySdkCode:sentry-sdk] from PyPI with the [sentryTornadoCode:tornado] extra:',
        {
          sentrySdkCode: <code />,
          sentryTornadoCode: <code />,
        }
      ),
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
        'If you have the [codeTornado:tornado] package in your dependencies, the Tornado integration will be enabled automatically when you initialize the Sentry SDK. Initialize the Sentry SDK before your app has been initialized:',
        {
          codeTornado: <code />,
        }
      ),
      configurations: [
        {
          language: 'python',
          code: `${getSdkSetupSnippet(params)}
class MainHandler(tornado.web.RequestHandler):
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

          code: `
import asyncio
import tornado
${getSdkSetupSnippet(params)}
class MainHandler(tornado.web.RequestHandler):
    def get(self):
        1/0  # raises an error
        self.write("Hello, world")

def make_app():
    return tornado.web.Application([
        (r"/", MainHandler),
    ])

async def main():
    app = make_app()
    app.listen(8888)
    await asyncio.Event().wait()

asyncio.run(main())
    `,
        },
      ],
      additionalInfo: (
        <div>
          <p>
            {tct(
              'When you point your browser to [link:http://localhost:8888/] a transaction in the Performance section of Sentry will be created.',
              {
                link: <ExternalLink href="http://localhost:8888/" />,
              }
            )}
          </p>
          <p>
            {t(
              'Additionally, an error event will be sent to Sentry and will be connected to the transaction.'
            )}
          </p>
          <p>{t('It takes a couple of moments for the data to appear in Sentry.')}</p>
        </div>
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
