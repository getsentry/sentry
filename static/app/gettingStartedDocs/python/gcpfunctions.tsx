import {Fragment} from 'react';
import styled from '@emotion/styled';

import Alert from 'sentry/components/alert';
import ExternalLink from 'sentry/components/links/externalLink';
import {StepType} from 'sentry/components/onboarding/gettingStartedDoc/step';
import {
  type Docs,
  DocsPageLocation,
  type DocsParams,
  type OnboardingConfig,
} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {
  AlternativeConfiguration,
  crashReportOnboardingPython,
} from 'sentry/gettingStartedDocs/python/python';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';

type Params = DocsParams;

const getInstallSnippet = () => `pip install --upgrade sentry-sdk`;

const getSdkSetupSnippet = (params: Params) => `
import sentry_sdk
from sentry_sdk.integrations.gcp import GcpIntegration

sentry_sdk.init(
    dsn="${params.dsn.public}",
    integrations=[GcpIntegration()],${
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

def http_function_entrypoint(request):
    ...`;

const getTimeoutWarningSnippet = (params: Params) => `
sentry_sdk.init(
    dsn="${params.dsn.public}",
    integrations=[
        GcpIntegration(timeout_warning=True),
    ],
)`;

const onboarding: OnboardingConfig = {
  install: (params: Params) => [
    {
      type: StepType.INSTALL,
      description: (
        <p>{tct('Install our Python SDK using [code:pip]:', {code: <code />})}</p>
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
      description: t(
        'You can use the Google Cloud Functions integration for the Python SDK like this:'
      ),
      configurations: [
        {
          language: 'python',
          code: getSdkSetupSnippet(params),
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
          {tct("Check out Sentry's [link:GCP sample apps] for detailed examples.", {
            link: (
              <ExternalLink href="https://github.com/getsentry/examples/tree/master/gcp-cloud-functions" />
            ),
          })}
        </Fragment>
      ),
    },
    {
      title: t('Timeout Warning'),
      description: tct(
        'The timeout warning reports an issue when the function execution time is near the [link:configured timeout].',
        {
          link: (
            <ExternalLink href="https://cloud.google.com/functions/docs/concepts/execution-environment#timeout" />
          ),
        }
      ),
      configurations: [
        {
          description: tct(
            'To enable the warning, update the SDK initialization to set [code:timeout_warning] to [code:true]:',
            {code: <code />}
          ),
          language: 'python',
          code: getTimeoutWarningSnippet(params),
        },
        {
          description: t(
            'The timeout warning is sent only if the timeout in the Cloud Function configuration is set to a value greater than one second.'
          ),
        },
      ],
      additionalInfo: (
        <AlertWithMarginBottom type="info">
          {tct(
            'If you are using a web framework in your Cloud Function, the framework might catch those exceptions before we get to see them. Make sure to enable the framework specific integration as well, if one exists. See [link:Integrations] for more information.',
            {
              link: (
                <ExternalLink href="https://docs.sentry.io/platforms/python/#integrations" />
              ),
            }
          )}
        </AlertWithMarginBottom>
      ),
    },
  ],
  verify: () => [],
};

const docs: Docs = {
  onboarding,

  crashReportOnboarding: crashReportOnboardingPython,
};

export default docs;

const AlertWithMarginBottom = styled(Alert)`
  margin-top: ${space(2)};
  margin-bottom: 0;
`;
