import ExternalLink from 'sentry/components/links/externalLink';
import {StepType} from 'sentry/components/onboarding/gettingStartedDoc/step';
import type {
  Docs,
  DocsParams,
  OnboardingConfig,
} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {getPythonMetricsOnboarding} from 'sentry/components/onboarding/gettingStartedDoc/utils/metricsOnboarding';
import replayOnboardingJsLoader from 'sentry/gettingStartedDocs/javascript/jsLoader/jsLoader';
import {crashReportOnboardingPython} from 'sentry/gettingStartedDocs/python/python';
import {t, tct} from 'sentry/locale';

type Params = DocsParams;

const getInstallSnippet = () => `pip install --upgrade sentry-sdk`;

const getSdkSetupSnippet = (params: Params) => `
import sentry_sdk

sentry_sdk.init(
    dsn="${params.dsn.public}",${
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
`;

const onboarding: OnboardingConfig = {
  introduction: () =>
    tct('The Bottle integration adds support for the [link:Bottle Web Framework].', {
      link: <ExternalLink href="https://bottlepy.org/docs/dev/" />,
    }),
  install: () => [
    {
      type: StepType.INSTALL,
      description: tct('Install [sentrySdkCode:sentry-sdk] from PyPI:', {
        sentrySdkCode: <code />,
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
        'If you have the [code:bottle] package in your dependencies, the Bottle integration will be enabled automatically when you initialize the Sentry SDK. Initialize the Sentry SDK before your app has been initialized:',
        {
          code: <code />,
        }
      ),
      configurations: [
        {
          language: 'python',
          code: `from bottle import Bottle
${getSdkSetupSnippet(params)}
app = Bottle()

###the following lines of code
###are for testing purposes
@app.route('/sentry-debug')
def sentry_debug():
    1/0
    return "Debug with Sentry"

run(app, host='localhost', port=8000)
      `,
        },
      ],
    },
  ],
  verify: () => [
    {
      type: StepType.VERIFY,
      description: t(
        'You can easily verify your Sentry installation by creating a route that triggers an error. The above snippet includes an endpoint [codeDebug:GET /sentry-debug]',
        {
          codeDebug: <code />,
        }
      ),
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

const docs: Docs = {
  onboarding,
  replayOnboardingJsLoader,
  customMetricsOnboarding: getPythonMetricsOnboarding({
    installSnippet: getInstallSnippet(),
  }),
  crashReportOnboarding: crashReportOnboardingPython,
};

export default docs;
