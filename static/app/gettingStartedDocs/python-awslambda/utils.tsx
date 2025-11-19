import {ExternalLink} from 'sentry/components/core/link';
import {
  StepType,
  type DocsParams,
  type OnboardingStep,
} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {alternativeProfiling} from 'sentry/gettingStartedDocs/python/profiling';
import {getPythonInstallCodeBlock} from 'sentry/gettingStartedDocs/python/utils';
import {t, tct} from 'sentry/locale';

const getSdkSetupSnippet = (params: DocsParams) => `
import sentry_sdk
from sentry_sdk.integrations.aws_lambda import AwsLambdaIntegration

sentry_sdk.init(
    dsn="${params.dsn.public}",
    # Add data like request headers and IP for users,
    # see https://docs.sentry.io/platforms/python/data-management/data-collected/ for more info
    send_default_pii=True,${
      params.isLogsSelected
        ? `
    # Enable sending logs to Sentry
    enable_logs=True,`
        : ''
    }
    integrations=[AwsLambdaIntegration()],${
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

def my_function(event, context):
    ....`;

export const installStep = (): OnboardingStep => ({
  type: StepType.INSTALL,
  content: [
    {
      type: 'text',
      text: tct('Install [code:sentry-sdk] from PyPI with the [code:django] extra:', {
        code: <code />,
      }),
    },
    getPythonInstallCodeBlock(),
  ],
});

export const configureStep = (params: DocsParams): OnboardingStep => ({
  type: StepType.CONFIGURE,
  content: [
    {
      type: 'text',
      text: t('You can use the AWS Lambda integration for the Python SDK like this:'),
    },
    {
      type: 'code',
      language: 'python',
      code: getSdkSetupSnippet(params),
    },
    alternativeProfiling(params),
    {
      type: 'text',
      text: tct("Check out Sentry's [link:AWS sample apps] for detailed examples.", {
        link: (
          <ExternalLink href="https://github.com/getsentry/examples/tree/master/aws-lambda/python" />
        ),
      }),
    },
  ],
});
