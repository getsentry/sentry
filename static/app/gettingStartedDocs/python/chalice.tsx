import ExternalLink from 'sentry/components/links/externalLink';
import {Layout, LayoutProps} from 'sentry/components/onboarding/gettingStartedDoc/layout';
import {ModuleProps} from 'sentry/components/onboarding/gettingStartedDoc/sdkDocumentation';
import {StepType} from 'sentry/components/onboarding/gettingStartedDoc/step';
import {t, tct} from 'sentry/locale';

// Configuration Start
export const steps = ({
  sentryInitContent,
}: {
  sentryInitContent: string;
}): LayoutProps['steps'] => [
  {
    type: StepType.INSTALL,
    description: (
      <p>
        {tct(
          'Install [sentrySdkCode:sentry-sdk] from PyPI with the [sentryBotteCode:chalice] extra:',
          {
            sentrySdkCode: <code />,
            sentryBotteCode: <code />,
          }
        )}
      </p>
    ),
    configurations: [
      {
        language: 'bash',
        code: 'pip install --upgrade sentry-sdk[chalice]',
      },
    ],
  },
  {
    type: StepType.CONFIGURE,
    configurations: [
      {
        language: 'python',
        code: `
import sentry_sdk
from chalice import Chalice

from sentry_sdk.integrations.chalice import ChaliceIntegration


sentry_sdk.init(
${sentryInitContent}
)

app = Chalice(app_name="appname")
      `,
      },
    ],
  },
  {
    type: StepType.VERIFY,
    description: (
      <p>{t('To verify that everything is working trigger an error on purpose:')}</p>
    ),
    configurations: [
      {
        language: 'python',
        code: `from chalice import Chalice

sentry_sdk.init(
${sentryInitContent}
)

app = Chalice(app_name="helloworld")

@app.schedule(Rate(1, unit=Rate.MINUTES))
def every_minute(event):
    1/0  # raises an error

@app.route("/")
def index():
    1/0  # raises an error
    return {"hello": "world"}`,
      },
    ],
    additionalInfo: (
      <span>
        <p>
          {tct(
            'When you enter the [code:"/"] route or the scheduled task is run, an error event will be sent to [link:sentry.io].',
            {
              link: <ExternalLink href="https://sentry.io" />,
              code: <code />,
            }
          )}
        </p>
        <p>
          {t(
            'Additionally, an error event will be sent to Sentry and will be connected to the transaction.'
          )}
        </p>
        <p>{t('It takes a couple of moments for the data to appear in Sentry.')}</p>
      </span>
    ),
  },
];
// Configuration End

export function GettingStartedWithChalice({dsn, ...props}: ModuleProps) {
  const otherConfigs: string[] = [];

  let sentryInitContent: string[] = [
    `    dsn="${dsn}",`,
    `    integrations=[ChaliceIntegration()],`,
  ];

  sentryInitContent = sentryInitContent.concat(otherConfigs);

  return (
    <Layout
      steps={steps({
        sentryInitContent: sentryInitContent.join('\n'),
      })}
      {...props}
    />
  );
}
export default GettingStartedWithChalice;
