import {Fragment} from 'react';

import ExternalLink from 'sentry/components/links/externalLink';
import {Layout, LayoutProps} from 'sentry/components/onboarding/gettingStartedDoc/layout';
import {ModuleProps} from 'sentry/components/onboarding/gettingStartedDoc/sdkDocumentation';
import {StepType} from 'sentry/components/onboarding/gettingStartedDoc/step';
import {t, tct} from 'sentry/locale';

// Configuration Start
const introduction = (
  <p>
    {tct('The celery integration adds support for the [link:Celery Task Queue System].', {
      link: <ExternalLink href="https://docs.celeryq.dev/en/stable/" />,
    })}
  </p>
);

export const steps = ({
  dsn,
}: Partial<Pick<ModuleProps, 'dsn'>> = {}): LayoutProps['steps'] => [
  {
    type: StepType.CONFIGURE,
    description: (
      <p>
        {tct(
          'Just add [celeryIntegrationCode:CeleryIntegration()] to your [integrationsCode:integrations] list:',
          {
            celeryIntegrationCode: <code />,
            integrationsCode: <code />,
          }
        )}
      </p>
    ),
    configurations: [
      {
        language: 'python',
        code: `
import sentry_sdk
from sentry_sdk.integrations.celery import CeleryIntegration

sentry_sdk.init(
    dsn='${dsn}',
    integrations=[
        CeleryIntegration(),
    ],

    # Set traces_sample_rate to 1.0 to capture 100%
    # of transactions for performance monitoring.
    # We recommend adjusting this value in production,
    traces_sample_rate=1.0,
)
      `,
      },
    ],
    additionalInfo: (
      <Fragment>
        {t(
          'Additionally, the Sentry Python SDK will set the transaction on the event to the task name, and it will improve the grouping for global Celery errors such as timeouts.'
        )}
        <p>
          {t('The integration will automatically report errors from all celery jobs.')}
        </p>
      </Fragment>
    ),
  },
];
// Configuration End

export function GettingStartedWithCelery({dsn, ...props}: ModuleProps) {
  return <Layout steps={steps({dsn})} introduction={introduction} {...props} />;
}

export default GettingStartedWithCelery;
