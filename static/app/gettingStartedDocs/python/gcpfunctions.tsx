import {Fragment} from 'react';
import styled from '@emotion/styled';

import Alert from 'sentry/components/alert';
import ExternalLink from 'sentry/components/links/externalLink';
import {Layout, LayoutProps} from 'sentry/components/onboarding/gettingStartedDoc/layout';
import {ModuleProps} from 'sentry/components/onboarding/gettingStartedDoc/sdkDocumentation';
import {StepType} from 'sentry/components/onboarding/gettingStartedDoc/step';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';

// Configuration Start
export const steps = ({
  dsn,
}: {
  dsn?: string;
} = {}): LayoutProps['steps'] => [
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
      'You can use the Google Cloud Functions integration for the Python SDK like this:'
    ),
    configurations: [
      {
        language: 'python',
        code: `
import sentry_sdk
from sentry_sdk.integrations.gcp import GcpIntegration

sentry_sdk.init(
  dsn="${dsn}",
  integrations=[
      GcpIntegration(),
  ],

  # Set traces_sample_rate to 1.0 to capture 100%
  # of transactions for performance monitoring.
  # We recommend adjusting this value in production,
  traces_sample_rate=1.0,
)

def http_function_entrypoint(request):
  ...
        `,
      },
    ],
    additionalInfo: (
      <p>
        {tct("Check out Sentry's [link:GCP sample apps] for detailed examples.", {
          link: (
            <ExternalLink href="https://github.com/getsentry/examples/tree/master/gcp-cloud-functions" />
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
              <ExternalLink href="https://cloud.google.com/functions/docs/concepts/execution-environment#timeout" />
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
      GcpIntegration(timeout_warning=True),
  ],

  # Set traces_sample_rate to 1.0 to capture 100%
  # of transactions for performance monitoring.
  # We recommend adjusting this value in production,
  traces_sample_rate=1.0,
)
        `,
      },
    ],
    additionalInfo: t(
      'The timeout warning is sent only if the timeout in the Cloud Function configuration is set to a value greater than one second.'
    ),
  },
];
// Configuration End

export function GettingStartedWithGCPFunctions({dsn, ...props}: ModuleProps) {
  return (
    <Fragment>
      <Layout steps={steps({dsn})} {...props} />
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
    </Fragment>
  );
}

export default GettingStartedWithGCPFunctions;

const AlertWithMarginBottom = styled(Alert)`
  margin-top: ${space(2)};
  margin-bottom: 0;
`;
