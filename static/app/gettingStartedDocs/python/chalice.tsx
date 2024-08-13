import ExternalLink from 'sentry/components/links/externalLink';
import {StepType} from 'sentry/components/onboarding/gettingStartedDoc/step';
import type {
  Docs,
  DocsParams,
  OnboardingConfig,
} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {getPythonMetricsOnboarding} from 'sentry/components/onboarding/gettingStartedDoc/utils/metricsOnboarding';
import {crashReportOnboardingPython} from 'sentry/gettingStartedDocs/python/python';
import {t, tct} from 'sentry/locale';

type Params = DocsParams;

const getInstallSnippet = () => `pip install --upgrade sentry-sdk`;

const getSdkSetupSnippet = (params: Params) => `
import sentry_sdk
from chalice import Chalice

from sentry_sdk.integrations.chalice import ChaliceIntegration

sentry_sdk.init(
    dsn="${params.dsn.public}",
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

@app.route("/sentry-debug")
def index():
    1/0  # raises an error
    return {"sentry": "debug"}`;

const onboarding: OnboardingConfig = {
  install: (params: Params) => [
    {
      type: StepType.INSTALL,
      description: tct('Install [sentrySdkCode:sentry-sdk] from PyPI:', {
        sentrySdkCode: <code />,
      }),
      configurations: [
        {
          description: params.isProfilingSelected
            ? tct(
                'You need a minimum version [codeVersion:1.18.0] of the [codePackage:sentry-python] SDK for the profiling feature.',
                {
                  codeVersion: <code />,
                  codePackage: <code />,
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
      additionalInfo: (
        <div>
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
        </div>
      ),
    },
  ],
  nextSteps: () => [],
};

const docs: Docs = {
  onboarding,
  customMetricsOnboarding: getPythonMetricsOnboarding({
    installSnippet: getInstallSnippet(),
  }),
  crashReportOnboarding: crashReportOnboardingPython,
};

export default docs;
