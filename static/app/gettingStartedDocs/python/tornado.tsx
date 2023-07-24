import ExternalLink from 'sentry/components/links/externalLink';
import {Layout, LayoutProps} from 'sentry/components/onboarding/gettingStartedDoc/layout';
import {ModuleProps} from 'sentry/components/onboarding/gettingStartedDoc/sdkDocumentation';
import {StepType} from 'sentry/components/onboarding/gettingStartedDoc/step';
import {t, tct} from 'sentry/locale';

// Configuration Start
const introduction = tct(
  'The Tornado integration adds support for the [link:Tornado Web Framework]. A Tornado version of 5 or greater and Python 3.6 or greater is required.',
  {
    link: <ExternalLink href="https://www.tornadoweb.org/en/stable/" />,
  }
);
export const steps = ({
  dsn,
}: {
  dsn?: string;
} = {}): LayoutProps['steps'] => [
  {
    type: StepType.INSTALL,
    description: <p>{tct('Install [code:sentry-sdk] from PyPI:', {code: <code />})}</p>,
    configurations: [
      {
        language: 'bash',
        code: '$ pip install --upgrade sentry-sdk',
      },
      {
        description: (
          <p>
            {tct(
              "If you're on Python 3.6, you also need the [code:aiocontextvars] package:",
              {
                code: <code />,
              }
            )}
          </p>
        ),
        language: 'bash',
        code: '$ pip install --upgrade aiocontextvars',
      },
    ],
  },
  {
    type: StepType.CONFIGURE,
    description: t('Initialize the SDK before starting the server:'),
    configurations: [
      {
        language: 'python',
        code: `
import sentry_sdk
from sentry_sdk.integrations.tornado import TornadoIntegration

sentry_sdk.init(
  dsn="${dsn}",
  integrations=[
    TornadoIntegration(),
  ],

  # Set traces_sample_rate to 1.0 to capture 100%
  # of transactions for performance monitoring.
  # We recommend adjusting this value in production,
  traces_sample_rate=1.0,
)

# Your app code here, without changes

class MyHandler(...):
...
      `,
      },
    ],
  },
];
// Configuration End

export function GettingStartedWithTornado({dsn, ...props}: ModuleProps) {
  return <Layout steps={steps({dsn})} introduction={introduction} {...props} />;
}

export default GettingStartedWithTornado;
