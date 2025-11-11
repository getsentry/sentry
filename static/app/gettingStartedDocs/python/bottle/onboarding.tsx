import {ExternalLink} from 'sentry/components/core/link';
import {
  StepType,
  type DocsParams,
  type OnboardingConfig,
} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {logsVerify} from 'sentry/gettingStartedDocs/python/python/logs';
import {metricsVerify} from 'sentry/gettingStartedDocs/python/python/metrics';
import {alternativeProfiling} from 'sentry/gettingStartedDocs/python/python/profiling';
import {getPythonInstallCodeBlock} from 'sentry/gettingStartedDocs/python/python/utils';
import {t, tct} from 'sentry/locale';

const getSdkSetupSnippet = (params: DocsParams) => `
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

export const onboarding: OnboardingConfig = {
  introduction: () =>
    tct('The Bottle integration adds support for the [link:Bottle Web Framework].', {
      link: <ExternalLink href="https://bottlepy.org/docs/dev/" />,
    }),
  install: () => [
    {
      type: StepType.INSTALL,
      content: [
        {
          type: 'text',
          text: tct('Install [code:sentry-sdk] from PyPI with the [code:bottle] extra:', {
            code: <code />,
          }),
        },
        getPythonInstallCodeBlock({packageName: 'sentry-sdk[bottle]'}),
      ],
    },
  ],
  configure: (params: DocsParams) => [
    {
      type: StepType.CONFIGURE,
      content: [
        {
          type: 'text',
          text: tct(
            'If you have the [code:bottle] package in your dependencies, the Bottle integration will be enabled automatically when you initialize the Sentry SDK. Initialize the Sentry SDK before your app has been initialized:',
            {
              code: <code />,
            }
          ),
        },
        {
          type: 'code',
          language: 'python',
          code: `from bottle import Bottle
${getSdkSetupSnippet(params)}
app = Bottle()
`,
        },
        alternativeProfiling(params),
      ],
    },
  ],
  verify: (params: DocsParams) => [
    {
      type: StepType.VERIFY,
      content: [
        {
          type: 'text',
          text: t('To verify that everything is working, trigger an error on purpose:'),
        },
        {
          type: 'code',
          language: 'python',
          code: `from bottle import Bottle, run
${getSdkSetupSnippet(params)}
app = Bottle()

@app.route('/')
def hello():
    1/0
    return "Hello World!"

run(app, host='localhost', port=8000)
`,
        },
        logsVerify(params),
        metricsVerify(params),
        {
          type: 'text',
          text: [
            tct(
              'When you point your browser to [link:http://localhost:8000/] a transaction in the Performance section of Sentry will be created.',
              {
                link: <ExternalLink href="http://localhost:8000/" />,
              }
            ),
            t(
              'Additionally, an error event will be sent to Sentry and will be connected to the transaction. '
            ),
            t('It takes a couple of moments for the data to appear in Sentry.'),
          ],
        },
      ],
    },
  ],
  nextSteps: (params: DocsParams) => {
    const steps = [];
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
