import {Fragment} from 'react';

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

const getInstallSnippet = () => `pip install --upgrade 'sentry-sdk[fastapi]'`;

const getSdkSetupSnippet = (params: Params) => `
from fastapi import FastAPI
import sentry_sdk

sentry_sdk.init(
    dsn="${params.dsn.public}",${
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
  introduction: () =>
    tct('The FastAPI integration adds support for the [link:FastAPI Framework].', {
      link: <ExternalLink href="https://fastapi.tiangolo.com/" />,
    }),
  install: (params: Params) => [
    {
      type: StepType.INSTALL,
      description: tct(
        'Install [code:sentry-sdk] from PyPI with the [code:fastapi] extra:',
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
        'If you have the [codeFastAPI:fastapi] package in your dependencies, the FastAPI integration will be enabled automatically when you initialize the Sentry SDK. Initialize the Sentry SDK before your app has been initialized:',
        {
          codeFastAPI: <code />,
        }
      ),
      configurations: [
        {
          language: 'python',
          code: `
${getSdkSetupSnippet(params)}
app = FastAPI()
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
            {
              code: <code />,
            }
          )}
          ,
        </Fragment>
      ),
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
          language: 'python',
          code: `
@app.get("/sentry-debug")
async def trigger_error():
    division_by_zero = 1 / 0
`,
        },
      ],
      additionalInfo: (
        <div>
          <p>
            {tct(
              'When you open [link:http://localhost:8000/sentry-debug/] with your browser, a transaction in the Performance section of Sentry will be created.',
              {
                link: <ExternalLink href="http://localhost:8000/sentry-debug/" />,
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

  crashReportOnboarding: crashReportOnboardingPython,
  featureFlagOnboarding,
  feedbackOnboardingJsLoader,
};

export default docs;
