import {Fragment} from 'react';
import styled from '@emotion/styled';

import {Alert} from 'sentry/components/core/alert';
import ExternalLink from 'sentry/components/links/externalLink';
import {
  type Docs,
  type DocsParams,
  type OnboardingConfig,
  type OnboardingStep,
  StepType,
} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {
  agentMonitoringOnboarding,
  AlternativeConfiguration,
  crashReportOnboardingPython,
} from 'sentry/gettingStartedDocs/python/python';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {getPythonInstallConfig} from 'sentry/utils/gettingStartedDocs/python';

type Params = DocsParams;

const getSdkSetupSnippet = (params: Params) => `
import sentry_sdk
from sentry_sdk.integrations.aws_lambda import AwsLambdaIntegration

sentry_sdk.init(
    dsn="${params.dsn.public}",
    # Add data like request headers and IP for users,
    # see https://docs.sentry.io/platforms/python/data-management/data-collected/ for more info
    send_default_pii=True,
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
  description: tct('Install [code:sentry-sdk] from PyPI with the [code:django] extra:', {
    code: <code />,
  }),
  configurations: getPythonInstallConfig(),
});

const configureStep = (params: Params): OnboardingStep => ({
  type: StepType.CONFIGURE,
  description: t('You can use the AWS Lambda integration for the Python SDK like this:'),
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
        <StyledAlert type="info">
          {tct(
            'If you are using another web framework inside of AWS Lambda, the framework might catch those exceptions before we get to see them. Make sure to enable the framework specific integration as well, if one exists. See [link:Integrations] for more information.',
            {
              link: (
                <ExternalLink href="https://docs.sentry.io/platforms/python/#integrations" />
              ),
            }
          )}
        </StyledAlert>
      ),
    },
  ],
  verify: () => [],
};

const profilingOnboarding: OnboardingConfig = {
  install: () => [installStep()],
  configure: (params: Params) => [configureStep(params)],
  verify: () => [],
};

const docs: Docs = {
  onboarding,
  crashReportOnboarding: crashReportOnboardingPython,
  profilingOnboarding,
  agentMonitoringOnboarding,
};

export default docs;

const StyledAlert = styled(Alert)`
  margin-top: ${space(2)};
`;
