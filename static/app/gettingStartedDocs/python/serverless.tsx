import {Fragment} from 'react';

import ExternalLink from 'sentry/components/links/externalLink';
import {StepType} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {
  type Docs,
  type DocsParams,
  type OnboardingConfig,
} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {
  agentMonitoringOnboarding,
  AlternativeConfiguration,
  crashReportOnboardingPython,
} from 'sentry/gettingStartedDocs/python/python';
import {t, tct} from 'sentry/locale';
import {
  getPythonInstallConfig,
  getPythonProfilingOnboarding,
} from 'sentry/utils/gettingStartedDocs/python';

type Params = DocsParams;

const getSdkSetupSnippet = (params: Params) => `
import sentry_sdk
from sentry_sdk.integrations.serverless import serverless_function

sentry_sdk.init(
    dsn="${params.dsn.public}",
    # Add data like request headers and IP for users,
    # see https://docs.sentry.io/platforms/python/data-management/data-collected/ for more info
    send_default_pii=True,${
      params.isPerformanceSelected
        ? `
    # Set traces_sample_rate to 1.0 to capture 100%
    # of transactions for tracing.
    traces_sample_rate=1.0,`
        : ''
    }${
      params.isProfilingSelected &&
      params.profilingOptions?.defaultProfilingMode !== 'continuous'
        ? `
    # Set profiles_sample_rate to 1.0 to profile 100%
    # of sampled transactions.
    # We recommend adjusting this value in production.
    profiles_sample_rate=1.0,`
        : params.isProfilingSelected &&
            params.profilingOptions?.defaultProfilingMode === 'continuous'
          ? `
    # Set profile_session_sample_rate to 1.0 to profile 100%
    # of profile sessions.
    profile_session_sample_rate=1.0,
    # Set profile_lifecycle to "trace" to automatically
    # run the profiler on when there is an active transaction
    profile_lifecycle="trace",`
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
      <p>
        {t(
          'If you use a serverless provider not directly supported by the SDK, you can use this generic integration.'
        )}
      </p>
    </Fragment>
  ),
  install: () => [
    {
      type: StepType.INSTALL,
      description: tct('Install [code:sentry-sdk] from PyPI:', {
        code: <code />,
      }),
      configurations: getPythonInstallConfig(),
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
      additionalInfo: params.isProfilingSelected &&
        params.profilingOptions?.defaultProfilingMode === 'continuous' && (
          <AlternativeConfiguration />
        ),
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
      additionalInfo: t(
        'Now deploy your function. When you now run your function an error event will be sent to Sentry.'
      ),
    },
  ],
};

const docs: Docs = {
  onboarding,
  profilingOnboarding: getPythonProfilingOnboarding(),
  crashReportOnboarding: crashReportOnboardingPython,
  agentMonitoringOnboarding,
};

export default docs;
