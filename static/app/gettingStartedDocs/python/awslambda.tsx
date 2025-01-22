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
import {trackAnalytics} from 'sentry/utils/analytics';
import {
  InstallationMode,
  platformOptions,
} from 'sentry/views/onboarding/integrationSetup';

type PlatformOptions = typeof platformOptions;
type Params = DocsParams<PlatformOptions>;

const getInstallSnippet = () => `pip install --upgrade sentry-sdk`;

const getSdkSetupSnippet = (params: Params) => `
import sentry_sdk
from sentry_sdk.integrations.aws_lambda import AwsLambdaIntegration

sentry_sdk.init(
    dsn="${params.dsn.public}",
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
    _experiments={
        # Set continuous_profiling_auto_start to True
        # to automatically start the profiler on when
        # possible.
        "continuous_profiling_auto_start": True,
    },`
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

const onboarding: OnboardingConfig<PlatformOptions> = {
  introduction: () =>
    tct(
      'Create a deployment package on your local machine and install the required dependencies in the deployment package. For more information, see [link:AWS Lambda deployment package in Python].',
      {
        link: (
          <ExternalLink href="https://docs.aws.amazon.com/lambda/latest/dg/python-package.html" />
        ),
      }
    ),
  install: (params: Params) => [
    {
      type: StepType.INSTALL,
      description: tct('Install our Python SDK using [code:pip]:', {code: <code />}),
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
        'You can use the AWS Lambda integration for the Python SDK like this:'
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
          {tct("Check out Sentry's [link:AWS sample apps] for detailed examples.", {
            link: (
              <ExternalLink href="https://github.com/getsentry/examples/tree/master/aws-lambda/python" />
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
            <ExternalLink href="https://docs.aws.amazon.com/lambda/latest/dg/configuration-function-common.html" />
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
            'The timeout warning is sent only if the timeout in the Lambda Function configuration is set to a value greater than one second.'
          ),
        },
      ],
      additionalInfo: (
        <AlertWithMarginBottom type="info">
          {tct(
            'If you are using another web framework inside of AWS Lambda, the framework might catch those exceptions before we get to see them. Make sure to enable the framework specific integration as well, if one exists. See [link:Integrations] for more information.',
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
  onPlatformOptionsChange(params) {
    return option => {
      if (option.installationMode === InstallationMode.MANUAL) {
        trackAnalytics('integrations.switch_manual_sdk_setup', {
          integration_type: 'first_party',
          integration: 'aws_lambda',
          view: 'onboarding',
          organization: params.organization,
        });
      }
    };
  },
};

const docs: Docs<PlatformOptions> = {
  onboarding,

  crashReportOnboarding: crashReportOnboardingPython,
  platformOptions,
};

export default docs;

const AlertWithMarginBottom = styled(Alert)`
  margin-top: ${space(2)};
  margin-bottom: 0;
`;
