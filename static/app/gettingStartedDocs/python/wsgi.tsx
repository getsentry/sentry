import {Fragment} from 'react';

import ExternalLink from 'sentry/components/links/externalLink';
import {StepType} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {
  type Docs,
  type DocsParams,
  type OnboardingConfig,
} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {
  agentMonitoringOnboarding,
  AlternativeConfiguration,
  crashReportOnboardingPython,
} from 'sentry/gettingStartedDocs/python/python';
import {t, tct} from 'sentry/locale';
import {
  getPythonInstallConfig,
  getPythonProfilingOnboarding,
} from 'sentry/utils/gettingStartedDocs/python';

type Params = DocsParams;

const getSdkSetupSnippet = (params: Params) => `
import sentry_sdk
from sentry_sdk.integrations.wsgi import SentryWsgiMiddleware

from my_wsgi_app import app

sentry_sdk.init(
    dsn="${params.dsn.public}",
    # Add data like request headers and IP for users,
    # see https://docs.sentry.io/platforms/python/data-management/data-collected/ for more info
    send_default_pii=True,${
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

const onboarding: OnboardingConfig = {
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
      description: tct('Install [code:sentry-sdk] from PyPI:', {
        code: <code />,
      }),
      configurations: getPythonInstallConfig(),
    },
  ],
  configure: params => [
    {
      type: StepType.CONFIGURE,
      description: t(
        'Then you can use this generic WSGI middleware. It captures errors and attaches a basic amount of information for incoming requests.'
      ),
      configurations: [
        {
          language: 'python',
          code: getSdkSetupSnippet(params),
        },
      ],
      additionalInfo: params.isProfilingSelected &&
        params.profilingOptions?.defaultProfilingMode === 'continuous' && (
          <AlternativeConfiguration />
        ),
    },
  ],
  verify: () => [
    {
      type: StepType.VERIFY,
      description: t(
        'You can easily verify your Sentry installation by creating a route that triggers an error:'
      ),
      configurations: [
        {
          language: 'python',
          code: getVerifySnippet(),
        },
      ],
      additionalInfo: (
        <Fragment>
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
        </Fragment>
      ),
    },
  ],
};

const docs: Docs = {
  onboarding,
  profilingOnboarding: getPythonProfilingOnboarding(),
  crashReportOnboarding: crashReportOnboardingPython,
  agentMonitoringOnboarding,
};

export default docs;
