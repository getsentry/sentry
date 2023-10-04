import {Fragment} from 'react';

import ExternalLink from 'sentry/components/links/externalLink';
import {Layout, LayoutProps} from 'sentry/components/onboarding/gettingStartedDoc/layout';
import {ModuleProps} from 'sentry/components/onboarding/gettingStartedDoc/sdkDocumentation';
import {StepType} from 'sentry/components/onboarding/gettingStartedDoc/step';
import {ProductSolution} from 'sentry/components/onboarding/productSelection';
import {t, tct} from 'sentry/locale';

// Configuration Start
const performanceConfiguration = `    # Set traces_sample_rate to 1.0 to capture 100%
    # of transactions for performance monitoring.
    traces_sample_rate=1.0,`;

const profilingConfiguration = `    # Set profiles_sample_rate to 1.0 to profile 100%
    # of sampled transactions.
    # We recommend adjusting this value in production.
    profiles_sample_rate=1.0,`;

export const steps = ({
  sentryInitContent,
}: {
  sentryInitContent: string;
}): LayoutProps['steps'] => [
  {
    type: StepType.INSTALL,
    description: (
      <Fragment>
        <p>
          {tct(
            'It is recommended to use an [link:integration for your particular WSGI framework if available], as those are easier to use and capture more useful information.',
            {
              link: (
                <ExternalLink href="https://docs.sentry.io/platforms/python/#web-frameworks" />
              ),
            }
          )}
        </p>
        {t(
          'If you use a WSGI framework not directly supported by the SDK, or wrote a raw WSGI app, you can use this generic WSGI middleware. It captures errors and attaches a basic amount of information for incoming requests.'
        )}
      </Fragment>
    ),
    configurations: [
      {
        language: 'python',
        code: `
import sentry_sdk
from sentry_sdk.integrations.wsgi import SentryWsgiMiddleware

from my_wsgi_app import app

sentry_sdk.init(
${sentryInitContent}
)

app = SentryWsgiMiddleware(app)
        `,
      },
    ],
  },
  {
    type: StepType.VERIFY,
    description: t(
      'You can easily verify your Sentry installation by creating a route that triggers an error:'
    ),
    configurations: [
      {
        language: 'python',
        code: `import sentry_sdk
from sentry_sdk.integrations.wsgi import SentryWsgiMiddleware

sentry_sdk.init(
${sentryInitContent}
)

def app(env, start_response):
    start_response('200 OK', [('Content-Type', 'text/plain')])
    response_body = 'Hello World'
    1/0  # this raises an error
    return [response_body.encode()]

app = SentryWsgiMiddleware(app)

# Run the application in a mini WSGI server.
from wsgiref.simple_server import make_server
make_server('', 8000, app).serve_forever()
        `,
      },
    ],
    additionalInfo: (
      <div>
        <p>
          {tct(
            'When you point your browser to [link:http://localhost:8000/] a transaction in the Performance section of Sentry will be created.',
            {
              link: <ExternalLink href="http://localhost:8000/" />,
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
];
// Configuration End

export function GettingStartedWithWSGI({
  dsn,
  activeProductSelection = [],
  ...props
}: ModuleProps) {
  const otherConfigs: string[] = [];

  let sentryInitContent: string[] = [`    dsn="${dsn}",`];

  if (activeProductSelection.includes(ProductSolution.PERFORMANCE_MONITORING)) {
    otherConfigs.push(performanceConfiguration);
  }

  if (activeProductSelection.includes(ProductSolution.PROFILING)) {
    otherConfigs.push(profilingConfiguration);
  }

  sentryInitContent = sentryInitContent.concat(otherConfigs);

  return (
    <Layout
      steps={steps({
        sentryInitContent: sentryInitContent.join('\n'),
      })}
      {...props}
    />
  );
}
export default GettingStartedWithWSGI;
