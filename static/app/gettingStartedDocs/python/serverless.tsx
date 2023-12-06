import {Fragment} from 'react';

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

export const steps = ({
  sentryInitContent,
}: {
  sentryInitContent: string;
}): LayoutProps['steps'] => [
  {
    type: StepType.INSTALL,
    description: (
      <Fragment>
        <p>
          {tct(
            'It is recommended to use an [link:integration for your particular serverless environment if available], as those are easier to use and capture more useful information.',
            {
              link: (
                <ExternalLink href="https://docs.sentry.io/platforms/python/#serverless" />
              ),
            }
          )}
        </p>
        {t(
          'If you use a serverless provider not directly supported by the SDK, you can use this generic integration.'
        )}
      </Fragment>
    ),
    configurations: [
      {
        language: 'python',
        description: (
          <p>
            {tct(
              'Apply the [code:serverless_function] decorator to each function that might throw errors:',
              {code: <code />}
            )}
          </p>
        ),
        code: `
import sentry_sdk
from sentry_sdk.integrations.serverless import serverless_function

sentry_sdk.init(
${sentryInitContent}
)

@serverless_function
def my_function(...): ...
        `,
      },
    ],
  },
  {
    type: StepType.VERIFY,
    description: (
      <p>
        {tct(
          'Wrap a functions with the [code:serverless_function] that triggers an error:',
          {
            code: <code />,
          }
        )}
      </p>
    ),
    configurations: [
      {
        language: 'python',
        code: `import sentry_sdk
from sentry_sdk.integrations.serverless import serverless_function

sentry_sdk.init(
${sentryInitContent}
)

@serverless_function
def my_function(...):
    1/0  # raises an error
      `,
      },
    ],
    additionalInfo: (
      <p>
        {tct(
          'Now deploy your function. When you now run your function an error event will be sent to Sentry.',
          {}
        )}
      </p>
    ),
  },
];
// Configuration End

export function GettingStartedWithServerless({
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
      steps={steps({
        sentryInitContent: sentryInitContent.join('\n'),
      })}
      {...props}
    />
  );
}

export default GettingStartedWithServerless;
