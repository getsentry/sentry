import {ExternalLink} from 'sentry/components/core/link';
import {
  StepType,
  type Docs,
  type DocsParams,
  type OnboardingConfig,
  type OnboardingStep,
} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {
  agentMonitoringOnboarding,
  crashReportOnboardingPython,
} from 'sentry/gettingStartedDocs/python/python';
import {t, tct} from 'sentry/locale';
import {
  alternativeProfilingConfiguration,
  getPythonInstallCodeBlock,
  getPythonLogsOnboarding,
  getVerifyLogsContent,
} from 'sentry/utils/gettingStartedDocs/python';

type Params = DocsParams;

const getSdkSetupSnippet = (params: Params) => `
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

const getTimeoutWarningSnippet = (params: Params) => `
sentry_sdk.init(
  dsn="${params.dsn.public}",
  integrations=[
      AwsLambdaIntegration(timeout_warning=True),
  ],
)`;

const installStep = (): OnboardingStep => ({
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

const configureStep = (params: Params): OnboardingStep => ({
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
    alternativeProfilingConfiguration(params),
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

const onboarding: OnboardingConfig = {
  introduction: () =>
    tct(
      'Create a deployment package on your local machine and install the required dependencies in the deployment package. For more information, see [link:AWS Lambda deployment package in Python].',
      {
        link: (
          <ExternalLink href="https://docs.aws.amazon.com/lambda/latest/dg/python-package.html" />
        ),
      }
    ),
  install: () => [installStep()],
  configure: (params: Params) => [
    configureStep(params),
    {
      title: t('Timeout Warning'),
      content: [
        {
          type: 'text',
          text: tct(
            'The timeout warning reports an issue when the function execution time is near the [link:configured timeout].',
            {
              link: (
                <ExternalLink href="https://docs.aws.amazon.com/lambda/latest/dg/configuration-function-common.html" />
              ),
            }
          ),
        },
        {
          type: 'text',
          text: tct(
            'To enable the warning, update the SDK initialization to set [code:timeout_warning] to [code:true]:',
            {code: <code />}
          ),
        },
        {
          type: 'code',
          language: 'python',
          code: getTimeoutWarningSnippet(params),
        },
        {
          type: 'text',
          text: t(
            'The timeout warning is sent only if the timeout in the Lambda Function configuration is set to a value greater than one second.'
          ),
        },
        {
          type: 'alert',
          alertType: 'info',
          text: tct(
            'If you are using another web framework inside of AWS Lambda, the framework might catch those exceptions before we get to see them. Make sure to enable the framework specific integration as well, if one exists. See [link:Integrations] for more information.',
            {
              link: (
                <ExternalLink href="https://docs.sentry.io/platforms/python/#integrations" />
              ),
            }
          ),
        },
      ],
    },
  ],
  verify: (params: Params) => [
    {
      type: StepType.VERIFY,
      content: [
        {
          type: 'text',
          text: t(
            'Deploy your function and invoke it to generate an error, then check Sentry for the captured event.'
          ),
        },
        getVerifyLogsContent(params),
      ],
    },
  ],
  nextSteps: (params: Params) => {
    const steps = [];
    if (params.isLogsSelected) {
      steps.push({
        id: 'logs',
        name: t('Logging Integrations'),
        description: t(
          'Add logging integrations to automatically capture logs from your application.'
        ),
        link: 'https://docs.sentry.io/platforms/python/logs/#integrations',
      });
    }
    return steps;
  },
};

const profilingOnboarding: OnboardingConfig = {
  install: () => [installStep()],
  configure: (params: Params) => [configureStep(params)],
  verify: () => [
    {
      type: StepType.VERIFY,
      content: [
        {
          type: 'text',
          text: t(
            'Verify that profiling is working correctly by simply using your application.'
          ),
        },
      ],
    },
  ],
};

const logsOnboarding = getPythonLogsOnboarding();

const docs: Docs = {
  onboarding,
  crashReportOnboarding: crashReportOnboardingPython,
  profilingOnboarding,
  agentMonitoringOnboarding,
  logsOnboarding,
};

export default docs;
