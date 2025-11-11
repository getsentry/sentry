import {ExternalLink} from 'sentry/components/core/link';
import {
  StepType,
  type DocsParams,
  type OnboardingConfig,
} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {logsVerify} from 'sentry/gettingStartedDocs/python/python/logs';
import {metricsVerify} from 'sentry/gettingStartedDocs/python/python/metrics';
import {alternativeProfiling} from 'sentry/gettingStartedDocs/python/python/profiling';
import {getPythonInstallCodeBlock} from 'sentry/gettingStartedDocs/python/python/utils';
import {t, tct} from 'sentry/locale';

const getSdkSetupSnippet = (params: DocsParams) => `
import sentry_sdk

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
`;

export const onboarding: OnboardingConfig = {
  introduction: () =>
    tct('The celery integration adds support for the [link:Celery Task Queue System].', {
      link: <ExternalLink href="https://docs.celeryq.dev/en/stable/" />,
    }),
  install: () => [
    {
      type: StepType.INSTALL,
      content: [
        {
          type: 'text',
          text: tct('Install [code:sentry-sdk] from PyPI with the [code:celery] extra:', {
            code: <code />,
          }),
        },
        getPythonInstallCodeBlock({packageName: 'sentry-sdk[celery]'}),
      ],
    },
  ],
  configure: (params: DocsParams) => [
    {
      type: StepType.CONFIGURE,
      content: [
        {
          type: 'text',
          text: [
            tct(
              'If you have the [code:celery] package in your dependencies, the Celery integration will be enabled automatically when you initialize the Sentry SDK.',
              {
                code: <code />,
              }
            ),
            tct(
              'Make sure that the call to [code:init] is loaded on worker startup, and not only in the module where your tasks are defined. Otherwise, the initialization happens too late and events might end up not being reported.',
              {
                code: <code />,
              }
            ),
          ],
        },
        {
          type: 'code',
          language: 'python',
          code: getSdkSetupSnippet(params),
        },
        alternativeProfiling(params),
        {
          type: 'subheader',
          text: t('Standalone Setup'),
        },
        {
          type: 'text',
          text: t(
            "If you're using Celery standalone, there are two ways to set this up:"
          ),
        },
        {
          type: 'list',
          items: [
            tct(
              "Initializing the SDK in the configuration file loaded with Celery's [code:--config] parameter",
              {
                code: <code />,
              }
            ),
            tct(
              'Initializing the SDK by hooking it to either the [celerydInit: celeryd_init] or [workerInit: worker_init] signals:',
              {
                celerydInit: (
                  <ExternalLink href="https://docs.celeryq.dev/en/stable/userguide/signals.html?#celeryd-init" />
                ),
                workerInit: (
                  <ExternalLink href="https://docs.celeryq.dev/en/stable/userguide/signals.html?#worker-init" />
                ),
              }
            ),
          ],
        },
        {
          type: 'code',
          language: 'python',
          code: `import sentry_sdk
from celery import Celery, signals

app = Celery("myapp")

#@signals.worker_init.connect
@signals.celeryd_init.connect
def init_sentry(**_kwargs):
    sentry_sdk.init(...)  # same as above`,
        },
        {
          type: 'subheader',
          text: t('Setup With Django'),
        },
        {
          type: 'text',
          text: tct(
            "If you're using Celery with Django in a conventional setup, have already initialized the SDK in [settingsLink:your settings.py], and have Celery using the same settings with [celeryDocsLinks:config_from_object], you don't need to initialize the SDK separately for Celery.",
            {
              settingsLink: (
                <ExternalLink href="https://docs.sentry.io/platforms/python/guides/django/#configure" />
              ),
              celeryDocsLinks: (
                <ExternalLink href="https://docs.celeryq.dev/en/stable/django/first-steps-with-django.html" />
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
            'You can easily verify your Sentry installation by creating a task that triggers an error:'
          ),
        },
        {
          type: 'code',
          language: 'python',
          code: `from celery import Celery

app = Celery("myapp")

@app.task
def hello():
  1/0  # raises an error
  return "world"

# Enqueue the task (ensure a worker is running)
hello.delay()
`,
        },
        logsVerify(params),
        metricsVerify(params),
      ],
    },
  ],
};
