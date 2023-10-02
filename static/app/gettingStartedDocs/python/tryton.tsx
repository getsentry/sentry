import ExternalLink from 'sentry/components/links/externalLink';
import {Layout, LayoutProps} from 'sentry/components/onboarding/gettingStartedDoc/layout';
import {ModuleProps} from 'sentry/components/onboarding/gettingStartedDoc/sdkDocumentation';
import {StepType} from 'sentry/components/onboarding/gettingStartedDoc/step';
import {t, tct} from 'sentry/locale';

// Configuration Start
const introduction = (
  <p>
    {tct('The Tryton integration adds support for the [link:Tryton Framework Server].', {
      link: <ExternalLink href="https://www.tryton.org/" />,
    })}
  </p>
);

export const steps = ({
  sentryInitContent,
}: {
  sentryInitContent: string;
}): LayoutProps['steps'] => [
  {
    type: StepType.CONFIGURE,
    description: (
      <p>
        {tct(
          'To configure the SDK, initialize it with the integration in a custom [code:wsgi.py] script:',
          {
            code: <code />,
          }
        )}
      </p>
    ),
    configurations: [
      {
        language: 'python',
        code: `# wsgi.py
import sentry_sdk
from sentry_sdk.integrations.trytond import TrytondWSGIIntegration

sentry_sdk.init(
  ${sentryInitContent}
  )

from trytond.application import app as application

# ...
        `,
      },
      {
        description: t(
          'In Tryton>=5.4 an error handler can be registered to respond the client with a custom error message including the Sentry event id instead of a traceback.'
        ),
        language: 'python',
        code: `
# wsgi.py
# ...

from trytond.exceptions import TrytonException
from trytond.exceptions import UserError

@application.error_handler
def _(app, request, e):
    if isinstance(e, TrytonException):
        return
    else:
        event_id = sentry_sdk.last_event_id()
        data = UserError('Custom message', f'{event_id}{e}')
        return app.make_response(request, data)
        `,
      },
    ],
  },
];
// Configuration End

export function GettingStartedWithTryton({dsn, ...props}: ModuleProps) {
  const otherConfigs: string[] = [];

  let sentryInitContent: string[] = [
    `    dsn="${dsn}",`,
    `    integrations=[`,
    `        sentry_sdk.integrations.trytond.TrytondWSGIIntegration(),`,
    `    ],`,
  ];

  sentryInitContent = sentryInitContent.concat(otherConfigs);

  return (
    <Layout
      introduction={introduction}
      steps={steps({
        sentryInitContent: sentryInitContent.join('\n'),
      })}
      {...props}
    />
  );
}

export default GettingStartedWithTryton;
