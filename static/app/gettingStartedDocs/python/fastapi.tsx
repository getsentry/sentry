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
    {tct('The FastAPI integration adds support for the [link:FastAPI Framework].', {
      link: <ExternalLink href="https://fastapi.tiangolo.com/" />,
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
          'Install [sentrySdkCode:sentry-sdk] from PyPI with the [sentryFastApiCode:fastapi] extra:',
          {
            sentrySdkCode: <code />,
            sentryFastApiCode: <code />,
          }
        )}
      </p>
    ),
    configurations: [
      {
        language: 'bash',
        code: "pip install --upgrade 'sentry-sdk[fastapi]'",
      },
    ],
  },
  {
    type: StepType.CONFIGURE,
    description: (
      <p>
        {tct(
          'If you have the [codeFastAPI:fastapi] package in your dependencies, the FastAPI integration will be enabled automatically when you initialize the Sentry SDK. Initialize the Sentry SDK before your app has been initialized:',
          {
            codeFastAPI: <code />,
          }
        )}
      </p>
    ),
    configurations: [
      {
        language: 'python',
        code: `
from fastapi import FastAPI

import sentry_sdk

sentry_sdk.init(
${sentryInitContent}
)

app = FastAPI()
      `,
      },
    ],
    additionalInfo: (
      <p>
        {tct(
          'The above configuration captures both error and performance data. To reduce the volume of performance data captured, change [code:traces_sample_rate] to a value between 0 and 1.',
          {
            code: <code />,
          }
        )}
      </p>
    ),
  },
  {
    type: StepType.VERIFY,
    description: t(
      'You can easily verify your Sentry installation by creating a route that triggers an error:'
    ),
    configurations: [
      {
        language: 'python',
        code: `
from fastapi import FastAPI

import sentry_sdk

sentry_sdk.init(
${sentryInitContent}
)

app = FastAPI()

@app.get("/sentry-debug")
async def trigger_error():
    division_by_zero = 1 / 0
      `,
      },
    ],
    additionalInfo: (
      <div>
        <p>
          {tct(
            'When you point your browser to [link:http://localhost:8000/sentry-debug/] a transaction in the Performance section of Sentry will be created.',
            {
              link: <ExternalLink href="http://localhost:8000/sentry-debug/" />,
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

export function GettingStartedWithFastApi({
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

export default GettingStartedWithFastApi;
