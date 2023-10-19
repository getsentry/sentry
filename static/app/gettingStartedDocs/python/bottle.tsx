import ExternalLink from 'sentry/components/links/externalLink';
import {Layout, LayoutProps} from 'sentry/components/onboarding/gettingStartedDoc/layout';
import {ModuleProps} from 'sentry/components/onboarding/gettingStartedDoc/sdkDocumentation';
import {StepType} from 'sentry/components/onboarding/gettingStartedDoc/step';
import {ProductSolution} from 'sentry/components/onboarding/productSelection';
import {t, tct} from 'sentry/locale';

// Configuration Start
const performanceConfiguration = `    # Set traces_sample_rate to 1.0 to capture 100%
    # of transactions for performance monitoring.
    traces_sample_rate=1.0,`;

const profilingConfiguration = `    # Set profiles_sample_rate to 1.0 to profile 100%
    # of sampled transactions.
    # We recommend adjusting this value in production.
    profiles_sample_rate=1.0,`;

const introduction = (
  <p>
    {tct('The Bottle integration adds support for the [link:Bottle Web Framework].', {
      link: <ExternalLink href="https://bottlepy.org/docs/dev/" />,
    })}
  </p>
);

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
          'Install [sentrySdkCode:sentry-sdk] from PyPI with the [sentryBotteCode:bottle] extra:',
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
        code: 'pip install --upgrade sentry-sdk[bottle]',
      },
    ],
  },
  {
    type: StepType.CONFIGURE,
    description: (
      <p>
        {tct(
          'If you have the [code:bottle] package in your dependencies, the Bottle integration will be enabled automatically when you initialize the Sentry SDK. Initialize the Sentry SDK before your app has been initialized:',
          {
            code: <code />,
          }
        )}
      </p>
    ),
    configurations: [
      {
        language: 'python',
        code: `
import sentry_sdk

from bottle import Bottle

sentry_sdk.init(
${sentryInitContent}
)

app = Bottle()
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
        code: `from bottle import Bottle, run

sentry_sdk.init(
  ${sentryInitContent}
)

app = Bottle()

@app.route('/')
def hello():
    1/0
    return "Hello World!"

run(app, host='localhost', port=8000)
      `,
      },
    ],
    additionalInfo: (
      <span>
        <p>
          {tct(
            'When you point your browser to [link:http://localhost:8000/] a transaction in the Performance section of Sentry will be created.',
            {
              link: <ExternalLink href="http://localhost:8000/" />,
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

export function GettingStartedWithBottle({
  dsn,
  activeProductSelection = [],
  ...props
}: ModuleProps) {
  const otherConfigs: string[] = [];

  let sentryInitContent: string[] = [`    dsn="${dsn}",`];

  if (activeProductSelection.includes(ProductSolution.PERFORMANCE_MONITORING)) {
    otherConfigs.push(performanceConfiguration);
  }

  if (activeProductSelection.includes(ProductSolution.PROFILING)) {
    otherConfigs.push(profilingConfiguration);
  }

  sentryInitContent = sentryInitContent.concat(otherConfigs);

  return (
    <Layout
      introduction={introduction}
      steps={steps({
        sentryInitContent: sentryInitContent.join('\n'),
      })}
      {...props}
    />
  );
}

export default GettingStartedWithBottle;
