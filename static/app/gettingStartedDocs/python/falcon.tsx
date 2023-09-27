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
    {tct('The Falcon integration adds support for the [link:Falcon Web Framework].', {
      link: <ExternalLink href="https://falconframework.org/" />,
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
          'Install [sentrySdkCode:sentry-sdk] from PyPI with the [sentryFalconCode:falcon] extra:',
          {
            sentrySdkCode: <code />,
            sentryFalconCode: <code />,
          }
        )}
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
    description: (
      <p>
        {tct(
          'If you have the [codeFalcon:falcon] package in your dependencies, the Falcon integration will be enabled automatically when you initialize the Sentry SDK. Initialize the Sentry SDK before your app has been initialized:',
          {
            codeFalcon: <code />,
          }
        )}
      </p>
    ),
    configurations: [
      {
        language: 'python',
        code: `
import falcon
import sentry_sdk

sentry_sdk.init(
${sentryInitContent}
)

api = falcon.API()
      `,
      },
    ],
  },
  {
    type: StepType.VERIFY,
    description: t('To verify that everything is working trigger an error on purpose:'),
    configurations: [
      {
        language: 'python',
        code: `import falcon
imoprt sentry_sdk

sentry_sdk.init(
${sentryInitContent}
)

class HelloWorldResource:
    def on_get(self, req, resp):
        message = {
            'hello': "world",
        }
        1 / 0  # raises an error
        resp.media = message

app = falcon.App()
app.add_route('/', HelloWorldResource())
      `,
      },
    ],
    additionalInfo: (
      <div>
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
      </div>
    ),
  },
];
// Configuration End

export function GettingStartedWithFalcon({
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

export default GettingStartedWithFalcon;
