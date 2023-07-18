import {Fragment} from 'react';

import ExternalLink from 'sentry/components/links/externalLink';
import {Layout, LayoutProps} from 'sentry/components/onboarding/gettingStartedDoc/layout';
import {ModuleProps} from 'sentry/components/onboarding/gettingStartedDoc/sdkDocumentation';
import {StepType} from 'sentry/components/onboarding/gettingStartedDoc/step';
import {t, tct} from 'sentry/locale';

// Configuration Start

// It is recommended to use an integration for your particular serverless environment if available, as those are easier to use and capture more useful information.

// If you use a serverless provider not directly supported by the SDK, you can use this generic integration.

export const steps = ({
  dsn,
}: {
  dsn?: string;
} = {}): LayoutProps['steps'] => [
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
    dsn="${dsn}",

    # Set traces_sample_rate to 1.0 to capture 100%
    # of transactions for performance monitoring.
    # We recommend adjusting this value in production,
    traces_sample_rate=1.0,
)

@serverless_function
def my_function(...): ...
        `,
      },
    ],
  },
];
// Configuration End

export function GettingStartedWithServerless({dsn, ...props}: ModuleProps) {
  return <Layout steps={steps({dsn})} {...props} />;
}

export default GettingStartedWithServerless;
