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
from chalice import Chalice

from sentry_sdk.integrations.chalice import ChaliceIntegration

sentry_sdk.init(
    dsn="${params.dsn.public}",
    integrations=[ChaliceIntegration()],
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

app = Chalice(app_name="appname")`;

const getVerifySnippet = () => `
@app.schedule(Rate(1, unit=Rate.MINUTES))
def every_minute(event):
    1/0  # raises an error

@app.route("/")
def index():
    1/0  # raises an error
    return {"hello": "world"}`;

export const onboarding: OnboardingConfig = {
  install: () => [
    {
      type: StepType.INSTALL,
      content: [
        {
          type: 'text',
          text: tct(
            'Install [code:sentry-sdk] from PyPI with the [code:chalice] extra:',
            {
              code: <code />,
            }
          ),
        },
        getPythonInstallCodeBlock({packageName: 'sentry-sdk[chalice]'}),
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
          code: getSdkSetupSnippet(params),
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
          text: t('To verify that everything is working trigger an error on purpose:'),
        },
        {
          type: 'code',
          language: 'python',
          code: getVerifySnippet(),
        },
        logsVerify(params),
        metricsVerify(params),
        {
          type: 'text',
          text: tct(
            'When you enter the [code:"/"] route or the scheduled task is run, an error event will be sent to Sentry.',
            {
              code: <code />,
            }
          ),
        },
      ],
    },
  ],
};
