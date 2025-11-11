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
from sentry_sdk.integrations.quart import QuartIntegration
from quart import Quart

sentry_sdk.init(
    dsn="${params.dsn.public}",
    integrations=[QuartIntegration()],
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
    tct('The Quart integration adds support for the [link:Quart Web Framework].', {
      link: <ExternalLink href="https://quart.palletsprojects.com/" />,
    }),
  install: () => [
    {
      type: StepType.INSTALL,
      content: [
        {
          type: 'text',
          text: tct('Install [code:sentry-sdk] from PyPI with the [code:quart] extra:', {
            code: <code />,
          }),
        },
        getPythonInstallCodeBlock({packageName: 'sentry-sdk[quart]'}),
      ],
    },
  ],
  configure: (params: DocsParams) => [
    {
      type: StepType.CONFIGURE,
      content: [
        {
          type: 'text',
          text: t(
            'To configure the SDK, initialize it with the integration before or after your app has been initialized:'
          ),
        },
        {
          type: 'code',
          language: 'python',
          code: `
${getSdkSetupSnippet(params)}
app = Quart(__name__)
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
          text: t(
            'You can easily verify your Sentry installation by creating a route that triggers an error:'
          ),
        },
        {
          type: 'code',
          language: 'python',
          code: `
${getSdkSetupSnippet(params)}
app = Quart(__name__)

@app.route("/")
async def hello():
    1/0  # raises an error
    return {"hello": "world"}

app.run()
`,
        },
        logsVerify(params),
        metricsVerify(params),
        {
          type: 'text',
          text: [
            tct(
              'When you point your browser to [link:http://localhost:5000/] a trace will be created.',
              {
                link: <ExternalLink href="http://localhost:5000/" />,
              }
            ),
            t(
              'Additionally, an error event will be sent to Sentry and will be connected to the trace.'
            ),
            t('It takes a couple of moments for the data to appear in Sentry.'),
          ],
        },
      ],
    },
  ],
  nextSteps: (params: DocsParams) => {
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
