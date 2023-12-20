import {StepType} from 'sentry/components/onboarding/gettingStartedDoc/step';
import type {
  Docs,
  DocsParams,
  OnboardingConfig,
} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {getPythonMetricsOnboarding} from 'sentry/components/onboarding/gettingStartedDoc/utils/metricsOnboarding';
import {t, tct} from 'sentry/locale';

type Params = DocsParams;

const getInstallSnippet = () => `pip install --upgrade sentry-sdk[chalice]`;

const getSdkSetupSnippet = (params: Params) => `
import sentry_sdk
from chalice import Chalice

from sentry_sdk.integrations.chalice import ChaliceIntegration

sentry_sdk.init(
    dsn="${params.dsn}",
    integrations=[ChaliceIntegration()],${
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
  install: () => [
    {
      type: StepType.INSTALL,
      description: tct(
        'Install [sentrySdkCode:sentry-sdk] from PyPI with the [sentryBotteCode:chalice] extra:',
        {
          sentrySdkCode: <code />,
          sentryBotteCode: <code />,
        }
      ),
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
      description: t(
        'To configure the SDK, initialize it with the integration before or after your app has been initialized:'
      ),
      configurations: [
        {
          language: 'python',
          code: getSdkSetupSnippet(params),
        },
      ],
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
  customMetricsOnboarding: getPythonMetricsOnboarding({
    installSnippet: getInstallSnippet(),
  }),
};

export default docs;
