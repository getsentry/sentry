import {Fragment} from 'react';
import styled from '@emotion/styled';

import Alert from 'sentry/components/alert';
import ExternalLink from 'sentry/components/links/externalLink';
import {Layout, LayoutProps} from 'sentry/components/onboarding/gettingStartedDoc/layout';
import {ModuleProps} from 'sentry/components/onboarding/gettingStartedDoc/sdkDocumentation';
import {StepType} from 'sentry/components/onboarding/gettingStartedDoc/step';
import {ProductSolution} from 'sentry/components/onboarding/productSelection';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';

// Configuration Start
const performanceConfiguration = `    # Set traces_sample_rate to 1.0 to capture 100%
    # of transactions for performance monitoring.
    traces_sample_rate=1.0,`;

const profilingConfiguration = `    # Set profiles_sample_rate to 1.0 to profile 100%
    # of sampled transactions.
    # We recommend adjusting this value in production.
    profiles_sample_rate=1.0,`;

const introduction = (
  <p>
    {tct(
      'Create a deployment package on your local machine and install the required dependencies in the deployment package. For more information, see [link:AWS Lambda deployment package in Python].',
      {
        link: (
          <ExternalLink href="https://docs.aws.amazon.com/lambda/latest/dg/python-package.html" />
        ),
      }
    )}
  </p>
);

export const steps = ({
  dsn,
  sentryInitContent,
}: {
  dsn: string;
  sentryInitContent: string;
}): LayoutProps['steps'] => [
  {
    type: StepType.INSTALL,
    description: (
      <p>{tct('Install our Python SDK using [code:pip]:', {code: <code />})}</p>
    ),
    configurations: [
      {
        language: 'bash',
        code: 'pip install --upgrade sentry-sdk',
      },
    ],
  },
  {
    type: StepType.CONFIGURE,
    description: t(
      'You can use the AWS Lambda integration for the Python SDK like this:'
    ),
    configurations: [
      {
        language: 'python',
        code: `
import sentry_sdk
from sentry_sdk.integrations.aws_lambda import AwsLambdaIntegration

sentry_sdk.init(
${sentryInitContent}
)

def my_function(event, context):
    ....
        `,
      },
    ],
    additionalInfo: (
      <p>
        {tct("Check out Sentry's [link:AWS sample apps] for detailed examples.", {
          link: (
            <ExternalLink href="https://github.com/getsentry/examples/tree/master/aws-lambda/python" />
          ),
        })}
      </p>
    ),
  },
  {
    title: t('Timeout Warning'),
    description: (
      <p>
        {tct(
          'The timeout warning reports an issue when the function execution time is near the [link:configured timeout].',
          {
            link: (
              <ExternalLink href="https://docs.aws.amazon.com/lambda/latest/dg/configuration-function-common.html" />
            ),
          }
        )}
      </p>
    ),
    configurations: [
      {
        description: (
          <p>
            {tct(
              'To enable the warning, update the SDK initialization to set [codeTimeout:timeout_warning] to [codeStatus:true]:',
              {codeTimeout: <code />, codeStatus: <code />}
            )}
          </p>
        ),
        language: 'python',
        code: `
sentry_sdk.init(
  dsn="${dsn}",
  integrations=[
      AwsLambdaIntegration(timeout_warning=True),
  ],
)
        `,
      },
    ],
    additionalInfo: t(
      'The timeout warning is sent only if the timeout in the Lambda Function configuration is set to a value greater than one second.'
    ),
  },
];
// Configuration End

export function GettingStartedWithAwsLambda({
  dsn,
  activeProductSelection = [],
  ...props
}: ModuleProps) {
  const otherConfigs: string[] = [];

  let sentryInitContent: string[] = [
    `    dsn="${dsn}",`,
    `    integrations=[AwsLambdaIntegration()],`,
  ];

  if (activeProductSelection.includes(ProductSolution.PERFORMANCE_MONITORING)) {
    otherConfigs.push(performanceConfiguration);
  }

  if (activeProductSelection.includes(ProductSolution.PROFILING)) {
    otherConfigs.push(profilingConfiguration);
  }

  sentryInitContent = sentryInitContent.concat(otherConfigs);

  return (
    <Fragment>
      <Layout
        introduction={introduction}
        steps={steps({dsn, sentryInitContent: sentryInitContent.join('\n')})}
        {...props}
      />
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
    </Fragment>
  );
}

export default GettingStartedWithAwsLambda;

const AlertWithMarginBottom = styled(Alert)`
  margin-top: ${space(2)};
  margin-bottom: 0;
`;
