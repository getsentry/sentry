import {ExternalLink} from 'sentry/components/core/link';
import {
  StepType,
  type DocsParams,
  type OnboardingConfig,
} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {logsVerify} from 'sentry/gettingStartedDocs/python/python/logs';
import {metricsVerify} from 'sentry/gettingStartedDocs/python/python/metrics';
import {t, tct} from 'sentry/locale';

import {configureStep, installStep} from './utils';

const getTimeoutWarningSnippet = (params: DocsParams) => `
sentry_sdk.init(
  dsn="${params.dsn.public}",
  integrations=[
      AwsLambdaIntegration(timeout_warning=True),
  ],
)`;

export const onboarding: OnboardingConfig = {
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
  configure: (params: DocsParams) => [
    configureStep(params),
    {
      title: t('Timeout Warning'),
      content: [
        {
          type: 'text',
          text: tct(
            'The timeout warning reports an issue when the function execution time is near the [link:configured timeout].',
            {
              link: (
                <ExternalLink href="https://docs.aws.amazon.com/lambda/latest/dg/configuration-function-common.html" />
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
            'The timeout warning is sent only if the timeout in the Lambda Function configuration is set to a value greater than one second.'
          ),
        },
        {
          type: 'alert',
          alertType: 'info',
          text: tct(
            'If you are using another web framework inside of AWS Lambda, the framework might catch those exceptions before we get to see them. Make sure to enable the framework specific integration as well, if one exists. See [link:Integrations] for more information.',
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
