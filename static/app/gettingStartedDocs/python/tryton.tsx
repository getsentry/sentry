import ExternalLink from 'sentry/components/links/externalLink';
import {Layout, LayoutProps} from 'sentry/components/onboarding/gettingStartedDoc/layout';
import {ModuleProps} from 'sentry/components/onboarding/gettingStartedDoc/sdkDocumentation';
import {StepType} from 'sentry/components/onboarding/gettingStartedDoc/step';
import {ProductSolution} from 'sentry/components/onboarding/productSelection';
import {t, tct} from 'sentry/locale';

// Configuration Start

const profilingConfiguration = `    # Set profiles_sample_rate to 1.0 to profile 100%
    # of sampled transactions.
    # We recommend adjusting this value in production.
    profiles_sample_rate=1.0,`;

const performanceConfiguration = `    # Set traces_sample_rate to 1.0 to capture 100%
    # of transactions for performance monitoring.
    # We recommend adjusting this value in production.
    traces_sample_rate=1.0,`;

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
        code: `
# wsgi.py
import sentry_sdk
import sentry_sdk.integrations.trytond

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

export function GettingStartedWithTryton({
  dsn,
  activeProductSelection = [],
  ...props
}: ModuleProps) {
  const otherConfigs: string[] = [];

  let sentryInitContent: string[] = [
    `    dsn="${dsn}",`,
    `    integrations=[`,
    `        sentry_sdk.integrations.trytond.TrytondWSGIIntegration(),`,
    `    ],`,
  ];

  if (activeProductSelection.includes(ProductSolution.PERFORMANCE_MONITORING)) {
    otherConfigs.push(performanceConfiguration);
  }

  if (activeProductSelection.includes(ProductSolution.PROFILING)) {
    otherConfigs.push(profilingConfiguration);
  }

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
