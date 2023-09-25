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

const introduction = tct(
  'The Starlette integration adds support for the Starlette Framework.',
  {
    link: <ExternalLink href="https://www.starlette.io/" />,
  }
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
          'Install [sentrySdkCode:sentry-sdk] from PyPI with the [sentryStarletteCode:starlette] extra:',
          {
            sentrySdkCode: <code />,
            sentryStarletteCode: <code />,
          }
        )}
      </p>
    ),
    configurations: [
      {
        language: 'bash',
        code: "pip install --upgrade 'sentry-sdk[starlette]'",
      },
    ],
  },
  {
    type: StepType.CONFIGURE,
    description: (
      <p>
        {tct(
          'If you have the [codeStarlette:starlette] package in your dependencies, the Starlette integration will be enabled automatically when you initialize the Sentry SDK. Initialize the Sentry SDK before your app has been initialized:',
          {
            codeStarlette: <code />,
          }
        )}
      </p>
    ),
    configurations: [
      {
        language: 'python',
        code: `from starlette.applications import Starlette
import sentry_sdk

sentry_sdk.init(
${sentryInitContent}
)

app = Starlette(routes=[...])
      `,
      },
    ],
  },
  {
    type: StepType.VERIFY,
    description: t(
      'You can easily verify your Sentry installation by creating a route that triggers an error:'
    ),
    configurations: [
      {
        language: 'python',
        code: `from starlette.applications import Starlette
from starlette.routing import Route

sentry_sdk.init(
  ${sentryInitContent}
  )

async def trigger_error(request):
    division_by_zero = 1 / 0

app = Starlette(routes=[
    Route("/sentry-debug", trigger_error),
])
    `,
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
    ],
  },
];
// Configuration End

export function GettingStartedWithStarlette({
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

export default GettingStartedWithStarlette;
