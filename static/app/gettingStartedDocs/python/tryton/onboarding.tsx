import {ExternalLink} from 'sentry/components/core/link';
import type {
  DocsParams,
  OnboardingConfig,
} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {StepType} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {metricsVerify} from 'sentry/gettingStartedDocs/python/python/metrics';
import {alternativeProfiling} from 'sentry/gettingStartedDocs/python/python/profiling';
import {getPythonInstallCodeBlock} from 'sentry/gettingStartedDocs/python/python/utils';
import {t, tct} from 'sentry/locale';

const getSdkSetupSnippet = (params: DocsParams) => `
import sentry_sdk
from sentry_sdk.integrations.trytond import TrytondWSGIIntegration

sentry_sdk.init(
    dsn="${params.dsn.public}",
    integrations=[TrytondWSGIIntegration()],
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

from trytond.application import app as application

# ...`;

const getErrorHandlerSnippet = () => `
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
        return app.make_response(request, data)`;

export const onboarding: OnboardingConfig = {
  introduction: () =>
    tct('The Tryton integration adds support for the [link:Tryton Framework Server].', {
      link: <ExternalLink href="https://www.tryton.org/" />,
    }),
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
  configure: (params: DocsParams) => [
    {
      type: StepType.CONFIGURE,
      content: [
        {
          type: 'text',
          text: tct(
            'To configure the SDK, initialize it with the integration in a custom [code:wsgi.py] script:',
            {
              code: <code />,
            }
          ),
        },
        {
          type: 'code',
          tabs: [
            {
              label: 'wsgi.py',
              language: 'python',
              code: getSdkSetupSnippet(params),
            },
          ],
        },
        {
          type: 'text',
          text: t(
            'In Tryton>=5.4 an error handler can be registered to respond the client with a custom error message including the Sentry event id instead of a traceback.'
          ),
        },
        {
          type: 'code',
          tabs: [
            {
              label: 'wsgi.py',
              language: 'python',
              code: getErrorHandlerSnippet(),
            },
          ],
        },
        alternativeProfiling(params),
      ],
    },
  ],
  verify: params => [
    {
      type: StepType.VERIFY,
      content: [metricsVerify(params)],
    },
  ],
};
