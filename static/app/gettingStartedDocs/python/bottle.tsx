import ExternalLink from 'sentry/components/links/externalLink';
import {Layout, LayoutProps} from 'sentry/components/onboarding/gettingStartedDoc/layout';
import {ModuleProps} from 'sentry/components/onboarding/gettingStartedDoc/sdkDocumentation';
import {StepType} from 'sentry/components/onboarding/gettingStartedDoc/step';
import {ProductSolution} from 'sentry/components/onboarding/productSelection';
import {t, tct} from 'sentry/locale';

// Configuration Start

const profilingConfiguration = `    # Set profiles_sample_rate to 1.0 to profile 100%
    # of sampled transactions.
    # We recommend adjusting this value in production.
    profiles_sample_rate=1.0,`;

const performanceConfiguration = `    # Set traces_sample_rate to 1.0 to capture 100%
    # of transactions for performance monitoring.
    # We recommend adjusting this value in production.
    traces_sample_rate=1.0,`;

const introduction = (
  <p>
    {tct(
      "The Bottle integration adds support for the Bottle Web Framework. Currently it works well with the stable version of Bottle (0.12). However the integration with the development version (0.13) doesn't work properly.",
      {
        link: <ExternalLink href="https://bottlepy.org/docs/dev/" />,
      }
    )}
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
        code: 'pip install --upgrade sentry-sdk[chalice]',
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
import sentry_sdk

from bottle import Bottle, run
from sentry_sdk.integrations.bottle import BottleIntegration

sentry_sdk.init(
${sentryInitContent}
)

app = Bottle()
      `,
      },
    ],
  },
];
// Configuration End

export function GettingStartedWithBottle({
  dsn,
  activeProductSelection = [],
  ...props
}: ModuleProps) {
  const otherConfigs: string[] = [];

  let sentryInitContent: string[] = [
    `    dsn="${dsn}",`,
    `    integrations=[BottleIntegration()],`,
  ];

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
