import {Fragment} from 'react';

import ExternalLink from 'sentry/components/links/externalLink';
import {StepType} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {
  type Docs,
  type DocsParams,
  type OnboardingConfig,
} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {
  feedbackOnboardingJsLoader,
  replayOnboardingJsLoader,
} from 'sentry/gettingStartedDocs/javascript/jsLoader/jsLoader';
import {
  agentMonitoringOnboarding,
  AlternativeConfiguration,
  crashReportOnboardingPython,
  featureFlagOnboarding,
} from 'sentry/gettingStartedDocs/python/python';
import {t, tct} from 'sentry/locale';
import {
  getPythonInstallConfig,
  getPythonProfilingOnboarding,
} from 'sentry/utils/gettingStartedDocs/python';

type Params = DocsParams;

const getSdkSetupSnippet = (params: Params) => `import sentry_sdk
from flask import Flask

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
`;

const onboarding: OnboardingConfig = {
  introduction: () =>
    tct('The Flask integration adds support for the [link:Flask Framework].', {
      link: <ExternalLink href="https://flask.palletsprojects.com" />,
    }),
  install: () => [
    {
      type: StepType.INSTALL,
      description: tct(
        'Install [code:sentry-sdk] from PyPI with the [code:flask] extra:',
        {
          code: <code />,
        }
      ),
      configurations: getPythonInstallConfig({packageName: 'sentry-sdk[flask]'}),
    },
  ],
  configure: (params: Params) => [
    {
      type: StepType.CONFIGURE,
      description: tct(
        'If you have the [codeFlask:flask] package in your dependencies, the Flask integration will be enabled automatically when you initialize the Sentry SDK. Initialize the Sentry SDK before your app has been initialized:',
        {
          codeFlask: <code />,
        }
      ),
      configurations: [
        {
          language: 'python',
          code: `${getSdkSetupSnippet(params)}
app = Flask(__name__)
`,
        },
      ],
      additionalInfo: (
        <Fragment>
          {params.isProfilingSelected &&
            params.profilingOptions?.defaultProfilingMode === 'continuous' && (
              <Fragment>
                <AlternativeConfiguration />
                <br />
              </Fragment>
            )}
          {tct(
            'The above configuration captures both error and performance data. To reduce the volume of performance data captured, change [code:traces_sample_rate] to a value between 0 and 1.',
            {code: <code />}
          )}
        </Fragment>
      ),
    },
  ],
  verify: (params: Params) => [
    {
      type: StepType.VERIFY,
      description: t(
        'You can easily verify your Sentry installation by creating a route that triggers an error:'
      ),
      configurations: [
        {
          language: 'python',

          code: `${getSdkSetupSnippet(params)}
app = Flask(__name__)

@app.route("/")
def hello_world():
    1/0  # raises an error
    return "<p>Hello, World!</p>"
`,
        },
      ],
      additionalInfo: (
        <span>
          <p>
            {tct(
              'When you point your browser to [link:http://localhost:5000/] a transaction in the Performance section of Sentry will be created.',
              {
                link: <ExternalLink href="http://localhost:5000/" />,
              }
            )}
          </p>
          <p>
            {t(
              'Additionally, an error event will be sent to Sentry and will be connected to the transaction.'
            )}
          </p>
          <p>{t('It takes a couple of moments for the data to appear in Sentry.')}</p>
        </span>
      ),
    },
  ],
  nextSteps: () => [],
};

const performanceOnboarding: OnboardingConfig = {
  introduction: () =>
    t(
      "Adding Performance to your Flask project is simple. Make sure you've got these basics down."
    ),
  install: onboarding.install,
  configure: params => [
    {
      type: StepType.CONFIGURE,
      configurations: [
        {
          language: 'python',
          description: tct(
            'To configure the Sentry SDK, initialize it in your [code:settings.py] file:',
            {code: <code />}
          ),
          code: `
import sentry-sdk

sentry_sdk.init(
    dsn: "${params.dsn.public}",
    # Set traces_sample_rate to 1.0 to capture 100%
    # of transactions for performance monitoring.
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
    },
  ],
  nextSteps: () => [],
};

const docs: Docs = {
  onboarding,
  replayOnboardingJsLoader,
  profilingOnboarding: getPythonProfilingOnboarding({basePackage: 'sentry-sdk[flask]'}),
  performanceOnboarding,
  crashReportOnboarding: crashReportOnboardingPython,
  featureFlagOnboarding,
  feedbackOnboardingJsLoader,
  agentMonitoringOnboarding,
};

export default docs;
