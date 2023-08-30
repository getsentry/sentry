import {Fragment} from 'react';

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
  <Fragment>
    <p>
      {tct(
        'The Quart integration adds support for the Quart Web Framework. We support Quart versions 0.16.1 and higher.',
        {
          link: <ExternalLink href="https://gitlab.com/pgjones/quart" />,
        }
      )}
    </p>
    {t('A Python version of "3.7" or higher is also required.')}
  </Fragment>
);

export const steps = ({
  sentryInitContent,
}: {
  sentryInitContent: string;
}): LayoutProps['steps'] => [
  {
    type: StepType.INSTALL,
    description: <p>{tct('Install [code:sentry-sdk] from PyPI:', {code: <code />})}</p>,
    configurations: [
      {
        language: 'bash',
        code: '$ pip install --upgrade sentry-sdk',
      },
    ],
  },
  {
    type: StepType.CONFIGURE,
    description: t(
      'To configure the SDK, initialize it with the integration before or after your app has been initialized:'
    ),
    configurations: [
      {
        language: 'python',
        code: `
import sentry_sdk
from sentry_sdk.integrations.quart import QuartIntegration
from quart import Quart

sentry_sdk.init(
${sentryInitContent}
)

app = Quart(__name__)
      `,
      },
    ],
  },
];
// Configuration End

export function GettingStartedWithQuart({
  dsn,
  activeProductSelection = [],
  ...props
}: ModuleProps) {
  const otherConfigs: string[] = [];

  let sentryInitContent: string[] = [
    `    dsn="${dsn}",`,
    `    integrations=[QuartIntegration()],`,
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

export default GettingStartedWithQuart;
