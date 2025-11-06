import {ExternalLink} from 'sentry/components/core/link';
import {
  StepType,
  type Docs,
  type DocsParams,
  type OnboardingConfig,
} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {
  feedbackOnboardingJsLoader,
  replayOnboardingJsLoader,
} from 'sentry/gettingStartedDocs/javascript/jsLoader/jsLoader';
import {
  agentMonitoringOnboarding,
  crashReportOnboardingPython,
  featureFlagOnboarding,
  mcpOnboarding,
} from 'sentry/gettingStartedDocs/python/python';
import {t, tct} from 'sentry/locale';
import {
  alternativeProfilingConfiguration,
  getPythonAiocontextvarsCodeBlocks,
  getPythonInstallCodeBlock,
  getPythonLogsOnboarding,
  getPythonProfilingOnboarding,
  getVerifyLogsContent,
} from 'sentry/utils/gettingStartedDocs/python';

type Params = DocsParams;

const getSdkSetupSnippet = (params: Params) => `
import sentry_sdk

sentry_sdk.init(
    dsn="${params.dsn.public}",
    # Add data like request headers and IP for users,
    # see https://docs.sentry.io/platforms/python/data-management/data-collected/ for more info
    send_default_pii=True,${
      params.isLogsSelected
        ? `
    # Enable sending logs to Sentry
    enable_logs=True,`
        : ''
    }${
      params.isPerformanceSelected
        ? `
    # Set traces_sample_rate to 1.0 to capture 100%
    # of transactions for tracing.
    traces_sample_rate=1.0,`
        : ''
    }${
      params.isProfilingSelected &&
      params.profilingOptions?.defaultProfilingMode !== 'continuous'
        ? `
    # Set profiles_sample_rate to 1.0 to profile 100%
    # of sampled transactions.
    # We recommend adjusting this value in production.
    profiles_sample_rate=1.0,`
        : params.isProfilingSelected &&
            params.profilingOptions?.defaultProfilingMode === 'continuous'
          ? `
    # Set profile_session_sample_rate to 1.0 to profile 100%
    # of profile sessions.
    profile_session_sample_rate=1.0,
    # Set profile_lifecycle to "trace" to automatically
    # run the profiler on when there is an active transaction
    profile_lifecycle="trace",`
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
      content: [
        {
          type: 'text',
          text: tct(
            'Install [code:sentry-sdk] from PyPI with the [code:tornado] extra:',
            {
              code: <code />,
            }
          ),
        },
        getPythonInstallCodeBlock(),
        ...getPythonAiocontextvarsCodeBlocks(),
      ],
    },
  ],
  configure: (params: Params) => [
    {
      type: StepType.CONFIGURE,
      content: [
        {
          type: 'text',
          text: tct(
            'If you have the [codeTornado:tornado] package in your dependencies, the Tornado integration will be enabled automatically when you initialize the Sentry SDK. Initialize the Sentry SDK before your app has been initialized:',
            {
              codeTornado: <code />,
            }
          ),
        },
        {
          type: 'code',
          language: 'python',
          code: `
${getSdkSetupSnippet(params)}
class MainHandler(tornado.web.RequestHandler):
    # ...
`,
        },
        alternativeProfilingConfiguration(params),
      ],
    },
  ],
  verify: (params: Params) => [
    {
      type: StepType.VERIFY,
      content: [
        {
          type: 'text',
          text: t(
            'You can easily verify your Sentry installation by creating a route that triggers an error:'
          ),
        },
        {
          type: 'code',
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
        getVerifyLogsContent(params),
        {
          type: 'text',
          text: [
            tct(
              'When you point your browser to [link:http://localhost:8888/] a transaction in the Performance section of Sentry will be created.',
              {
                link: <ExternalLink href="http://localhost:8888/" />,
              }
            ),
            t(
              'Additionally, an error event will be sent to Sentry and will be connected to the transaction.'
            ),
            t('It takes a couple of moments for the data to appear in Sentry.'),
          ],
        },
      ],
    },
  ],
  nextSteps: (params: Params) => {
    const steps = [] as any[];
    if (params.isLogsSelected) {
      steps.push({
        id: 'logs',
        name: t('Logging Integrations'),
        description: t(
          'Add logging integrations to automatically capture logs from your application.'
        ),
        link: 'https://docs.sentry.io/platforms/python/logs/#integrations',
      });
    }
    return steps;
  },
};

const logsOnboarding = getPythonLogsOnboarding({
  packageName: 'sentry-sdk[tornado]',
});

const docs: Docs = {
  onboarding,
  replayOnboardingJsLoader,
  profilingOnboarding: getPythonProfilingOnboarding(),
  crashReportOnboarding: crashReportOnboardingPython,
  featureFlagOnboarding,
  feedbackOnboardingJsLoader,
  agentMonitoringOnboarding,
  mcpOnboarding,
  logsOnboarding,
};

export default docs;
