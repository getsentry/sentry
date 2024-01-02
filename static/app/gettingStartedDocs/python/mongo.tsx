import ExternalLink from 'sentry/components/links/externalLink';
import {StepType} from 'sentry/components/onboarding/gettingStartedDoc/step';
import type {
  Docs,
  DocsParams,
  OnboardingConfig,
} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {getPythonMetricsOnboarding} from 'sentry/components/onboarding/gettingStartedDoc/utils/metricsOnboarding';
import {t, tct} from 'sentry/locale';

type Params = DocsParams;

const getSdkSetupSnippet = (params: Params) => `
import sentry_sdk
from sentry_sdk.integrations.pymongo import PyMongoIntegration


sentry_sdk.init(
    dsn="${params.dsn}",
    integrations=[
        PyMongoIntegration(),
    ],

    # Set traces_sample_rate to 1.0 to capture 100%
    # of transactions for performance monitoring.
    # We recommend adjusting this value in production,
    traces_sample_rate=1.0,
)`;

const getInstallSnippet = () => `pip install --upgrade sentry-sdk[pymongo]`;

const onboarding: OnboardingConfig = {
  introduction: () =>
    tct(
      'The PyMongo integration adds support for [link:PyMongo], the official MongoDB driver. It adds breadcrumbs and performace traces for all queries.',
      {
        link: <ExternalLink href="https://www.mongodb.com/docs/drivers/pymongo/" />,
      }
    ),
  install: () => [
    {
      type: StepType.INSTALL,
      description: tct(
        'Install [sentrySdkCode:sentry-sdk] from PyPI with the [pymongoCode:pymongo] extra:',
        {
          sentrySdkCode: <code />,
          pymongoCode: <code />,
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
        "To configure the SDK, initialize it before creating any of PyMongo's MongoClient instances:"
      ),
      configurations: [
        {
          language: 'python',
          code: getSdkSetupSnippet(params),
        },
      ],
      additionalInfo: tct(
        'The above configuration captures both breadcrumbs and performance data. To reduce the volume of performance data captured, change [code:traces_sample_rate] to a value between 0 and 1.',
        {code: <code />}
      ),
    },
  ],
  verify: () => [],
};

const docs: Docs = {
  onboarding,
  customMetricsOnboarding: getPythonMetricsOnboarding({
    installSnippet: getInstallSnippet(),
  }),
};

export default docs;
