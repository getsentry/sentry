import {ExternalLink} from 'sentry/components/core/link';
import {
  StepType,
  type DocsParams,
  type OnboardingConfig,
} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {logsVerify} from 'sentry/gettingStartedDocs/python/python/logs';
import {metricsVerify} from 'sentry/gettingStartedDocs/python/python/metrics';
import {alternativeProfiling} from 'sentry/gettingStartedDocs/python/python/profiling';
import {getPythonInstallCodeBlock} from 'sentry/gettingStartedDocs/python/python/utils';
import {t, tct} from 'sentry/locale';

const getSdkSetupSnippet = (params: DocsParams) => `
import sentry_sdk
from sentry_sdk.integrations.gcp import GcpIntegration

sentry_sdk.init(
    dsn="${params.dsn.public}",
    integrations=[GcpIntegration()],
    # Add data like request headers and IP for users,
    # see https://docs.sentry.io/platforms/python/data-management/data-collected/ for more info
    send_default_pii=True,${
      params.isLogsSelected
        ? `
    # Enable sending logs to Sentry
    enable_logs=True,`
        : ''
    }${
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

def http_function_entrypoint(request):
    ...`;

const getTimeoutWarningSnippet = (params: DocsParams) => `
sentry_sdk.init(
    dsn="${params.dsn.public}",
    integrations=[
        GcpIntegration(timeout_warning=True),
    ],
)`;

export const onboarding: OnboardingConfig = {
  install: () => [
    {
      type: StepType.INSTALL,
      content: [
        {
          type: 'text',
          text: tct('Install [code:sentry-sdk] from PyPI:', {
            code: <code />,
          }),
        },
        getPythonInstallCodeBlock(),
      ],
    },
  ],
  configure: (params: DocsParams) => [
    {
      type: StepType.CONFIGURE,
      content: [
        {
          type: 'text',
          text: t(
            'You can use the Google Cloud Functions integration for the Python SDK like this:'
          ),
        },
        {
          type: 'code',
          language: 'python',
          code: getSdkSetupSnippet(params),
        },
        alternativeProfiling(params),
        {
          type: 'text',
          text: tct("Check out Sentry's [link:GCP sample apps] for detailed examples.", {
            link: (
              <ExternalLink href="https://github.com/getsentry/examples/tree/master/gcp-cloud-functions" />
            ),
          }),
        },
      ],
    },
    {
      title: t('Timeout Warning'),
      content: [
        {
          type: 'text',
          text: tct(
            'The timeout warning reports an issue when the function execution time is near the [link:configured timeout].',
            {
              link: (
                <ExternalLink href="https://cloud.google.com/functions/docs/concepts/execution-environment#timeout" />
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
            'The timeout warning is sent only if the timeout in the Cloud Function configuration is set to a value greater than one second.'
          ),
        },
        {
          type: 'alert',
          alertType: 'info',
          text: tct(
            'If you are using a web framework in your Cloud Function, the framework might catch those exceptions before we get to see them. Make sure to enable the framework specific integration as well, if one exists. See [link:Integrations] for more information.',
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
  verify: (params: DocsParams) => [
    {
      type: StepType.VERIFY,
      content: [
        {
          type: 'text',
          text: t(
            'Deploy your function and invoke it to generate an error, then check Sentry for the captured event.'
          ),
        },
        logsVerify(params),
        metricsVerify(params),
      ],
    },
  ],
  nextSteps: (params: DocsParams) => {
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
