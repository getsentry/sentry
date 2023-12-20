import {Fragment} from 'react';

import ExternalLink from 'sentry/components/links/externalLink';
import {StepType} from 'sentry/components/onboarding/gettingStartedDoc/step';
import type {
  Docs,
  DocsParams,
  OnboardingConfig,
} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {getPythonMetricsOnboarding} from 'sentry/components/onboarding/gettingStartedDoc/utils/metricsOnboarding';
import {t, tct} from 'sentry/locale';

type Params = DocsParams;

const getInstallSnippet = () => `pip install --upgrade sentry-sdk`;

const getSdkSetupSnippet = (params: Params) => `
import sentry_sdk
from sentry_sdk.integrations.serverless import serverless_function

sentry_sdk.init(
    dsn="${params.dsn}",${
      params.isPerformanceSelected
        ? `
    # Set traces_sample_rate to 1.0 to capture 100%
    # of transactions for performance monitoring.
    traces_sample_rate=1.0,`
        : ''
    }${
      params.isProfilingSelected
        ? `
    # Set profiles_sample_rate to 1.0 to profile 100%
    # of sampled transactions.
    # We recommend adjusting this value in production.
    profiles_sample_rate=1.0,`
        : ''
    }
)

@serverless_function
def my_function(...): ...`;

const getVerifySnippet = () => `import sentry_sdk
from sentry_sdk.integrations.serverless import serverless_function

sentry_sdk.init(...) # same as above

@serverless_function
def my_function(...):
    1/0  # raises an error`;

const onboarding: OnboardingConfig = {
  introduction: () => (
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
  install: () => [
    {
      type: StepType.INSTALL,
      description: tct('Install our Python SDK using [code:pip]:', {
        code: <code />,
      }),
      configurations: [
        {
          language: 'bash',
          code: getInstallSnippet(),
        },
      ],
    },
  ],
  configure: (params: Params) => [
    {
      type: StepType.CONFIGURE,
      description: tct(
        'Apply the [code:serverless_function] decorator to each function that might throw errors:',
        {code: <code />}
      ),
      configurations: [
        {
          language: 'python',
          code: getSdkSetupSnippet(params),
        },
      ],
    },
  ],
  verify: () => [
    {
      type: StepType.VERIFY,
      description: tct(
        'Wrap a functions with the [code:serverless_function] that triggers an error:',
        {
          code: <code />,
        }
      ),
      configurations: [
        {
          language: 'python',
          code: getVerifySnippet(),
        },
      ],
      additionalInfo: tct(
        'Now deploy your function. When you now run your function an error event will be sent to Sentry.',
        {}
      ),
    },
  ],
};

const docs: Docs = {
  onboarding,
  customMetricsOnboarding: getPythonMetricsOnboarding({
    installSnippet: getInstallSnippet(),
  }),
};

export default docs;
