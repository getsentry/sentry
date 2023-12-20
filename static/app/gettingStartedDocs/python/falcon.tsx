import ExternalLink from 'sentry/components/links/externalLink';
import {StepType} from 'sentry/components/onboarding/gettingStartedDoc/step';
import {
  Docs,
  DocsParams,
  OnboardingConfig,
} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {getPythonMetricsOnboarding} from 'sentry/components/onboarding/gettingStartedDoc/utils/metricsOnboarding';
import replayOnboardingJsLoader from 'sentry/gettingStartedDocs/javascript/jsLoader/jsLoader';
import {t, tct} from 'sentry/locale';

type Params = DocsParams;

const getInstallSnippet = () => `pip install --upgrade sentry-sdk[falcon]`;

const getSdkSetupSnippet = (params: Params) => `
import falcon
import sentry_sdk

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
`;

const onboarding: OnboardingConfig = {
  introduction: () =>
    tct('The Falcon integration adds support for the [link:Falcon Web Framework].', {
      link: <ExternalLink href="https://falconframework.org/" />,
    }),
  install: () => [
    {
      type: StepType.INSTALL,
      description: tct(
        'Install [sentrySdkCode:sentry-sdk] from PyPI with the [sentryFalconCode:falcon] extra:',
        {
          sentrySdkCode: <code />,
          sentryFalconCode: <code />,
        }
      ),
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
        'If you have the [codeFalcon:falcon] package in your dependencies, the Falcon integration will be enabled automatically when you initialize the Sentry SDK. Initialize the Sentry SDK before your app has been initialized:',
        {
          codeFalcon: <code />,
        }
      ),
      configurations: [
        {
          language: 'python',
          code: `
${getSdkSetupSnippet(params)}
api = falcon.API()
      `,
        },
      ],
    },
  ],
  verify: (params: Params) => [
    {
      type: StepType.VERIFY,
      description: t(
        'To verify that everything is working, trigger an error on purpose:'
      ),
      configurations: [
        {
          language: 'python',

          code: `
${getSdkSetupSnippet(params)}
class HelloWorldResource:
    def on_get(self, req, resp):
        message = {
            'hello': "world",
        }
        1 / 0  # raises an error
        resp.media = message

app = falcon.App()
app.add_route('/', HelloWorldResource())
      `,
        },
      ],
      additionalInfo: (
        <div>
          <p>
            {tct(
              'When you point your browser to [link:http://localhost:8000/] a transaction in the Performance section of Sentry will be created.',
              {
                link: <ExternalLink href="http://localhost:8000/" />,
              }
            )}
          </p>
          <p>
            {t(
              'Additionally, an error event will be sent to Sentry and will be connected to the transaction.'
            )}
          </p>
          <p>{t('It takes a couple of moments for the data to appear in Sentry.')}</p>
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
};

export default docs;
