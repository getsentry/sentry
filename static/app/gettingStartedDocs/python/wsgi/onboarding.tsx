import {Fragment} from 'react';

import {ExternalLink} from 'sentry/components/core/link';
import {
  StepType,
  type DocsParams,
  type OnboardingConfig,
} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {metricsVerify} from 'sentry/gettingStartedDocs/python/python/metrics';
import {alternativeProfiling} from 'sentry/gettingStartedDocs/python/python/profiling';
import {getPythonInstallCodeBlock} from 'sentry/gettingStartedDocs/python/python/utils';
import {t, tct} from 'sentry/locale';

const getSdkSetupSnippet = (params: DocsParams) => `
import sentry_sdk
from sentry_sdk.integrations.wsgi import SentryWsgiMiddleware

from my_wsgi_app import app

sentry_sdk.init(
    dsn="${params.dsn.public}",
    # Add data like request headers and IP for users,
    # see https://docs.sentry.io/platforms/python/data-management/data-collected/ for more info
    send_default_pii=True,${
      params.isLogsSelected
        ? `
    # Enable sending logs to Sentry
    enable_logs=True,`
        : ''
    }${
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

app = SentryWsgiMiddleware(app)`;

const getVerifySnippet = () => `
import sentry_sdk
from sentry_sdk.integrations.wsgi import SentryWsgiMiddleware

sentry_sdk.init(...)  # same as above

def app(env, start_response):
    start_response('200 OK', [('Content-Type', 'text/plain')])
    response_body = 'Hello World'
    1/0  # this raises an error
    return [response_body.encode()]

app = SentryWsgiMiddleware(app)

# Run the application in a mini WSGI server.
from wsgiref.simple_server import make_server
make_server('', 8000, app).serve_forever()`;

export const onboarding: OnboardingConfig = {
  introduction: () => (
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
      <p>
        {t(
          'If you use a WSGI framework not directly supported by the SDK, or wrote a raw WSGI app, you can use this generic WSGI middleware. It captures errors and attaches a basic amount of information for incoming requests.'
        )}
      </p>
    </Fragment>
  ),
  install: () => [
    {
      type: StepType.INSTALL,
      content: [
        {
          type: 'text',
          text: tct('Install [code:sentry-sdk] from PyPI:', {
            code: <code />,
          }),
        },
        getPythonInstallCodeBlock(),
      ],
    },
  ],
  configure: params => [
    {
      type: StepType.CONFIGURE,
      content: [
        {
          type: 'text',
          text: t(
            'Then you can use this generic WSGI middleware. It captures errors and attaches a basic amount of information for incoming requests.'
          ),
        },
        {
          type: 'code',
          language: 'python',
          code: getSdkSetupSnippet(params),
        },
        alternativeProfiling(params),
      ],
    },
  ],
  verify: params => [
    {
      type: StepType.VERIFY,
      content: [
        {
          type: 'text',
          text: t(
            'You can easily verify your Sentry installation by creating a route that triggers an error:'
          ),
        },
        {
          type: 'code',
          language: 'python',
          code: getVerifySnippet(),
        },
        metricsVerify(params),
        {
          type: 'text',
          text: [
            tct(
              'When you point your browser to [link:http://localhost:8000/] a transaction in the Performance section of Sentry will be created.',
              {
                link: <ExternalLink href="http://localhost:8000/" />,
              }
            ),
            t(
              'Additionally, an error event will be sent to Sentry and will be connected to the transaction.'
            ),
            t('It takes a couple of moments for the data to appear in Sentry.'),
          ],
        },
      ],
    },
  ],
  nextSteps: (params: DocsParams) => {
    const steps = [] as any[];
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
