import {ExternalLink} from 'sentry/components/core/link';
import {StepType} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {
  type Docs,
  type DocsParams,
  type OnboardingConfig,
} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {
  agentMonitoringOnboarding,
  crashReportOnboardingPython,
} from 'sentry/gettingStartedDocs/python/python';
import {t, tct} from 'sentry/locale';
import {getPythonInstallConfig} from 'sentry/utils/gettingStartedDocs/python';

type Params = DocsParams;

const getSdkSetupSnippet = (params: Params) => `
import sentry_sdk
from sentry_sdk.integrations.pymongo import PyMongoIntegration

sentry_sdk.init(
    dsn="${params.dsn.public}",
    integrations=[
        PyMongoIntegration(),
    ],

    # Add data like request headers and IP for users,
    # see https://docs.sentry.io/platforms/python/data-management/data-collected/ for more info
    send_default_pii=True,
    # Set traces_sample_rate to 1.0 to capture 100%
    # of transactions for tracing.
    # We recommend adjusting this value in production,
    traces_sample_rate=1.0,
)`;

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
        'Install [code:sentry-sdk] from PyPI with the [code:pymongo] extra:',
        {
          code: <code />,
        }
      ),
      configurations: getPythonInstallConfig({packageName: 'sentry-sdk[pymongo]'}),
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

  crashReportOnboarding: crashReportOnboardingPython,
  agentMonitoringOnboarding,
};

export default docs;
