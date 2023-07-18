import ExternalLink from 'sentry/components/links/externalLink';
import {Layout, LayoutProps} from 'sentry/components/onboarding/gettingStartedDoc/layout';
import {ModuleProps} from 'sentry/components/onboarding/gettingStartedDoc/sdkDocumentation';
import {StepType} from 'sentry/components/onboarding/gettingStartedDoc/step';
import {t, tct} from 'sentry/locale';

// Configuration Start
const introduction = (
  <p>
    {tct(
      'The Falcon integration adds support for the [link:Falcon Web Framework]. The integration has been confirmed to work with Falcon 1.4 and 2.0.',
      {
        link: <ExternalLink href="https://falconframework.org/" />,
      }
    )}
  </p>
);

export const steps = ({
  dsn,
}: {
  dsn?: string;
} = {}): LayoutProps['steps'] => [
  {
    type: StepType.INSTALL,
    description: (
      <p>
        {tct('Install [code:sentry-sdk] from PyPI with the [code:falcon] extra:', {
          code: <code />,
        })}
      </p>
    ),
    configurations: [
      {
        language: 'bash',
        code: "$ pip install --upgrade 'sentry-sdk[falcon]'",
      },
    ],
  },
  {
    type: StepType.CONFIGURE,
    description: t(
      'To configure the SDK, initialize it with the integration before your app has been initialized:'
    ),
    configurations: [
      {
        language: 'python',
        code: `
import falcon
import sentry_sdk
from sentry_sdk.integrations.falcon import FalconIntegration

sentry_sdk.init(
    dsn="${dsn}",
    integrations=[
      FalconIntegration(),
    ],

    # Set traces_sample_rate to 1.0 to capture 100%
    # of transactions for performance monitoring.
    # We recommend adjusting this value in production,
    traces_sample_rate=1.0,
)

api = falcon.API()
      `,
      },
    ],
  },
];
// Configuration End

export function GettingStartedWithFalcon({dsn, ...props}: ModuleProps) {
  return <Layout steps={steps({dsn})} introduction={introduction} {...props} />;
}

export default GettingStartedWithFalcon;
