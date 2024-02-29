import ExternalLink from 'sentry/components/links/externalLink';
import {StepType} from 'sentry/components/onboarding/gettingStartedDoc/step';
import type {
  Docs,
  DocsParams,
  OnboardingConfig,
} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {t, tct} from 'sentry/locale';

type Params = DocsParams;

const getSdkSetupSnippet = (params: Params) => `
# wsgi.py
import sentry_sdk
from sentry_sdk.integrations.trytond import TrytondWSGIIntegration

sentry_sdk.init(
    dsn="${params.dsn}",
    integrations:[
        sentry_sdk.integrations.trytond.TrytondWSGIIntegration(),
    ],${
      params.isPerformanceSelected
        ? `
    # Set traces_sample_rate to 1.0 to capture 100%
    # of transactions for performance monitoring.
    traces_sample_rate=1.0,`
        : ''
    }${
      params.isProfilingSelected
        ? `
    # Set profiles_sample_rate to 1.0 to profile 100%
    # of sampled transactions.
    # We recommend adjusting this value in production.
    profiles_sample_rate=1.0,`
        : ''
    }
)

from trytond.application import app as application

# ...`;

const getErrorHandlerSnippet = () => `# wsgi.py
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

const onboarding: OnboardingConfig = {
  introduction: () =>
    tct('The Tryton integration adds support for the [link:Tryton Framework Server].', {
      link: <ExternalLink href="https://www.tryton.org/" />,
    }),
  install: () => [],
  configure: (params: Params) => [
    {
      type: StepType.CONFIGURE,
      description: tct(
        'To configure the SDK, initialize it with the integration in a custom [code:wsgi.py] script:',
        {
          code: <code />,
        }
      ),
      configurations: [
        {
          language: 'python',
          code: getSdkSetupSnippet(params),
        },
        {
          description: t(
            'In Tryton>=5.4 an error handler can be registered to respond the client with a custom error message including the Sentry event id instead of a traceback.'
          ),
          language: 'python',
          code: getErrorHandlerSnippet(),
        },
      ],
    },
  ],
  verify: () => [],
};

const docs: Docs = {
  onboarding,
};

export default docs;
