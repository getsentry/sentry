import ExternalLink from 'sentry/components/links/externalLink';
import {StepType} from 'sentry/components/onboarding/gettingStartedDoc/step';
import {
  type Docs,
  DocsPageLocation,
  type DocsParams,
  type OnboardingConfig,
} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {
  feedbackOnboardingJsLoader,
  replayOnboardingJsLoader,
} from 'sentry/gettingStartedDocs/javascript/jsLoader/jsLoader';
import {
  AlternativeConfiguration,
  crashReportOnboardingPython,
  featureFlagOnboarding,
} from 'sentry/gettingStartedDocs/python/python';
import {t, tct} from 'sentry/locale';

type Params = DocsParams;

const getInstallSnippet = () => `pip install --upgrade 'sentry-sdk[django]'`;

const getSdkSetupSnippet = (params: Params) => `
import sentry_sdk

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
    _experiments={
        # Set continuous_profiling_auto_start to True
        # to automatically start the profiler on when
        # possible.
        "continuous_profiling_auto_start": True,
    },`
          : ''
    }
)
`;

const onboarding: OnboardingConfig = {
  install: (params: Params) => [
    {
      type: StepType.INSTALL,
      description: tct(
        'Install [code:sentry-sdk] from PyPI with the [code:django] extra:',
        {
          code: <code />,
        }
      ),
      configurations: [
        {
          description:
            params.docsLocation === DocsPageLocation.PROFILING_PAGE
              ? tct(
                  'You need a minimum version [code:1.18.0] of the [code:sentry-python] SDK for the profiling feature.',
                  {
                    code: <code />,
                  }
                )
              : undefined,
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
        'Initialize the Sentry SDK in your Django [code:settings.py] file:',
        {
          code: <code />,
        }
      ),
      configurations: [
        {
          code: [
            {
              label: 'settings.py',
              value: 'settings.py',
              language: 'python',
              code: getSdkSetupSnippet(params),
            },
          ],
        },
      ],
      additionalInfo: <AlternativeConfiguration />,
    },
  ],
  verify: () => [
    {
      type: StepType.VERIFY,
      description: t(
        'You can easily verify your Sentry installation by creating a route that triggers an error:'
      ),
      configurations: [
        {
          code: [
            {
              label: 'urls.py',
              value: 'urls.py',
              language: 'python',
              code: `
from django.urls import path

def trigger_error(request):
    division_by_zero = 1 / 0

urlpatterns = [
    path('sentry-debug/', trigger_error),
    # ...
]
                  `,
            },
          ],
        },
      ],
      additionalInfo: (
        <div>
          <p>
            {tct(
              'When you point your browser to [link:http://localhost:8000/sentry-debug/] an error with a trace will be created. So you can explore errors and tracing portions of Sentry.',
              {
                link: <ExternalLink href="http://localhost:8000/sentry-debug/" />,
              }
            )}
          </p>
          <br />
          <p>
            {t(
              'It can take a couple of moments for the data to appear in Sentry. Bear with us, the internet is huge.'
            )}
          </p>
        </div>
      ),
    },
  ],
  nextSteps: () => [],
};

const performanceOnboarding: OnboardingConfig = {
  introduction: () =>
    t(
      "Adding Performance to your Django project is simple. Make sure you've got these basics down."
    ),
  install: onboarding.install,
  configure: params => [
    {
      type: StepType.CONFIGURE,
      description: tct(
        'To configure the Sentry SDK, initialize it in your [code:settings.py] file:',
        {code: <code />}
      ),
      configurations: [
        {
          language: 'python',
          code: `
import sentry-sdk

sentry_sdk.init(
  dsn: "${params.dsn.public}",

  // Set traces_sample_rate to 1.0 to capture 100%
  // of transactions for performance monitoring.
  traces_sample_rate=1.0,
)`,
          additionalInfo: tct(
            'Learn more about tracing [linkTracingOptions:options], how to use the [linkTracesSampler:traces_sampler] function, or how to [linkSampleTransactions:sample transactions].',
            {
              linkTracingOptions: (
                <ExternalLink href="https://docs.sentry.io/platforms/python/configuration/options/#tracing-options" />
              ),
              linkTracesSampler: (
                <ExternalLink href="https://docs.sentry.io/platforms/python/configuration/sampling/" />
              ),
              linkSampleTransactions: (
                <ExternalLink href="https://docs.sentry.io/platforms/python/configuration/sampling/" />
              ),
            }
          ),
        },
      ],
    },
  ],
  verify: () => [
    {
      type: StepType.VERIFY,
      description: tct(
        'Verify that performance monitoring is working correctly with our [link:automatic instrumentation] by simply using your Python application.',
        {
          link: (
            <ExternalLink href="https://docs.sentry.io/platforms/python/tracing/instrumentation/automatic-instrumentation/" />
          ),
        }
      ),
      additionalInfo: tct(
        'You have the option to manually construct a transaction using [link:custom instrumentation].',
        {
          link: (
            <ExternalLink href="https://docs.sentry.io/platforms/python/tracing/instrumentation/custom-instrumentation/" />
          ),
        }
      ),
    },
  ],
  nextSteps: () => [],
};

const docs: Docs = {
  onboarding,
  replayOnboardingJsLoader,

  performanceOnboarding,
  crashReportOnboarding: crashReportOnboardingPython,
  featureFlagOnboarding,
  feedbackOnboardingJsLoader,
};

export default docs;
