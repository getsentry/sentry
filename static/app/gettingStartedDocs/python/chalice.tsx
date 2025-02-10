import {StepType} from 'sentry/components/onboarding/gettingStartedDoc/step';
import {
  type Docs,
  DocsPageLocation,
  type DocsParams,
  type OnboardingConfig,
} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {
  AlternativeConfiguration,
  crashReportOnboardingPython,
} from 'sentry/gettingStartedDocs/python/python';
import {t, tct} from 'sentry/locale';

type Params = DocsParams;

const getInstallSnippet = () => `pip install --upgrade 'sentry-sdk[chalice]'`;

const getSdkSetupSnippet = (params: Params) => `
import sentry_sdk
from chalice import Chalice

from sentry_sdk.integrations.chalice import ChaliceIntegration

sentry_sdk.init(
    dsn="${params.dsn.public}",
    integrations=[ChaliceIntegration()],
    # Add data like request headers and IP for users,
    # see https://docs.sentry.io/platforms/python/data-management/data-collected/ for more info
    send_default_pii=True,${
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
    _experiments={
        # Set continuous_profiling_auto_start to True
        # to automatically start the profiler on when
        # possible.
        "continuous_profiling_auto_start": True,
    },`
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

const onboarding: OnboardingConfig = {
  install: (params: Params) => [
    {
      type: StepType.INSTALL,
      description: tct(
        'Install [code:sentry-sdk] from PyPI with the [code:chalice] extra:',
        {
          code: <code />,
        }
      ),
      configurations: [
        {
          description:
            params.docsLocation === DocsPageLocation.PROFILING_PAGE
              ? tct(
                  'You need a minimum version [code:1.18.0] of the [code:sentry-python] SDK for the profiling feature.',
                  {
                    code: <code />,
                  }
                )
              : undefined,
          language: 'bash',
          code: getInstallSnippet(),
        },
      ],
    },
  ],
  configure: (params: Params) => [
    {
      type: StepType.CONFIGURE,
      description: t(
        'To configure the SDK, initialize it with the integration before or after your app has been initialized:'
      ),
      configurations: [
        {
          language: 'python',
          code: getSdkSetupSnippet(params),
        },
      ],
      additionalInfo: params.isProfilingSelected &&
        params.profilingOptions?.defaultProfilingMode === 'continuous' && (
          <AlternativeConfiguration />
        ),
    },
  ],
  verify: () => [
    {
      type: StepType.VERIFY,
      description: t('To verify that everything is working trigger an error on purpose:'),
      configurations: [
        {
          language: 'python',
          code: getVerifySnippet(),
        },
      ],
      additionalInfo: tct(
        'When you enter the [code:"/"] route or the scheduled task is run, an error event will be sent to Sentry.',
        {
          code: <code />,
        }
      ),
    },
  ],
};

const docs: Docs = {
  onboarding,

  crashReportOnboarding: crashReportOnboardingPython,
};

export default docs;
