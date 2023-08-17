import ExternalLink from 'sentry/components/links/externalLink';
import {Layout, LayoutProps} from 'sentry/components/onboarding/gettingStartedDoc/layout';
import {ModuleProps} from 'sentry/components/onboarding/gettingStartedDoc/sdkDocumentation';
import {StepType} from 'sentry/components/onboarding/gettingStartedDoc/step';
import {t, tct} from 'sentry/locale';

// Configuration Start
const introduction = (
  <p>
    {tct(
      'The PyMongo integration adds support for [link:PyMongo], the official MongoDB driver. It adds breadcrumbs and performace traces for all queries.',
      {
        link: <ExternalLink href="https://www.mongodb.com/docs/drivers/pymongo/" />,
      }
    )}
  </p>
);

export const steps = ({
  dsn,
}: Partial<Pick<ModuleProps, 'dsn'>> = {}): LayoutProps['steps'] => [
  {
    type: StepType.INSTALL,
    description: (
      <p>
        {tct(
          'Install [sentrySdkCode:sentry-sdk] from PyPI with the [pymongoCode:pymongo] extra:',
          {
            sentrySdkCode: <code />,
            pymongoCode: <code />,
          }
        )}
      </p>
    ),
    configurations: [
      {
        language: 'bash',
        code: `pip install --upgrade 'sentry-sdk[pymongo]'`,
      },
    ],
  },
  {
    type: StepType.CONFIGURE,
    description: t(
      "To configure the SDK, initialize it before creating any of PyMongo's MongoClient instances:"
    ),
    configurations: [
      {
        language: 'python',
        code: `
import sentry_sdk
from sentry_sdk.integrations.pymongo import PyMongoIntegration


sentry_sdk.init(
    dsn="${dsn}",
    integrations=[
        PyMongoIntegration(),
    ],

    # Set traces_sample_rate to 1.0 to capture 100%
    # of transactions for performance monitoring.
    # We recommend adjusting this value in production,
    traces_sample_rate=1.0,
)
      `,
      },
    ],
    additionalInfo: (
      <p>
        {tct(
          'The above configuration captures both breadcrumbs and performance data. To reduce the volume of performance data captured, change [code:traces_sample_rate] to a value between 0 and 1.',
          {code: <code />}
        )}
      </p>
    ),
  },
];
// Configuration End

export function GettingStartedWithMongo({dsn, ...props}: ModuleProps) {
  return <Layout steps={steps({dsn})} introduction={introduction} {...props} />;
}

export default GettingStartedWithMongo;
