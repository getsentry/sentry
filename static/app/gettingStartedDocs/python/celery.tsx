import {Fragment} from 'react';
import styled from '@emotion/styled';

import ExternalLink from 'sentry/components/links/externalLink';
import {OnboardingCodeSnippet} from 'sentry/components/onboarding/gettingStartedDoc/onboardingCodeSnippet';
import {StepType} from 'sentry/components/onboarding/gettingStartedDoc/step';
import {
  type Docs,
  DocsPageLocation,
  type DocsParams,
  type OnboardingConfig,
} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {
  AlternativeConfiguration,
  crashReportOnboardingPython,
} from 'sentry/gettingStartedDocs/python/python';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';

type Params = DocsParams;

const getInstallSnippet = () => `pip install --upgrade 'sentry-sdk[celery]'`;

const getSdkSetupSnippet = (params: Params) => `
import sentry_sdk

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
`;

const onboarding: OnboardingConfig = {
  introduction: () =>
    tct('The celery integration adds support for the [link:Celery Task Queue System].', {
      link: <ExternalLink href="https://docs.celeryq.dev/en/stable/" />,
    }),
  install: (params: Params) => [
    {
      type: StepType.INSTALL,
      description: tct(
        'Install [code:sentry-sdk] from PyPI with the [code:celery] extra:',
        {
          code: <code />,
        }
      ),
      configurations: [
        {
          description:
            params.docsLocation === DocsPageLocation.PROFILING_PAGE
              ? tct(
                  'You need a minimum version [code:2.24.1] of the [code:sentry-python] SDK for the profiling feature.',
                  {
                    code: <code />,
                  }
                )
              : undefined,
          language: 'bash',
          code: getInstallSnippet(),
        },
      ],
    },
  ],
  configure: (params: Params) => [
    {
      type: StepType.CONFIGURE,
      description: (
        <div>
          <p>
            {tct(
              'If you have the [code:celery] package in your dependencies, the Celery integration will be enabled automatically when you initialize the Sentry SDK.',
              {
                code: <code />,
              }
            )}
          </p>
          <p>
            {tct(
              'Make sure that the call to [code:init] is loaded on worker startup, and not only in the module where your tasks are defined. Otherwise, the initialization happens too late and events might end up not being reported.',
              {
                code: <code />,
              }
            )}
          </p>
        </div>
      ),
      configurations: [
        {
          language: 'python',
          code: getSdkSetupSnippet(params),
        },
      ],
      additionalInfo: (
        <Fragment>
          {params.isProfilingSelected &&
            params.profilingOptions?.defaultProfilingMode === 'continuous' && (
              <Fragment>
                <AlternativeConfiguration />
                <br />
              </Fragment>
            )}
          <h5>{t('Standalone Setup')}</h5>
          {t("If you're using Celery standalone, there are two ways to set this up:")}
          <ul>
            <li>
              {tct(
                "Initializing the SDK in the configuration file loaded with Celery's [code:--config] parameter",
                {
                  code: <code />,
                }
              )}
            </li>
            <li>
              {tct(
                'Initializing the SDK by hooking it to either the [celerydInit: celeryd_init] or [workerInit: worker_init] signals:',
                {
                  celerydInit: (
                    <ExternalLink href="https://docs.celeryq.dev/en/stable/userguide/signals.html?#celeryd-init" />
                  ),
                  workerInit: (
                    <ExternalLink href="https://docs.celeryq.dev/en/stable/userguide/signals.html?#worker-init" />
                  ),
                }
              )}
            </li>
          </ul>
          <SpacedOnboardingCodeSnippet dark language="python">
            {`import sentry_sdk
from celery import Celery, signals

app = Celery("myapp")

#@signals.worker_init.connect
@signals.celeryd_init.connect
def init_sentry(**_kwargs):
    sentry_sdk.init(...)  # same as above`}
          </SpacedOnboardingCodeSnippet>
          <h5>{t('Setup With Django')}</h5>
          <p>
            {tct(
              "If you're using Celery with Django in a conventional setup, have already initialized the SDK in [settingsLink:your settings.py], and have Celery using the same settings with [celeryDocsLinks:config_from_object], you don't need to initialize the SDK separately for Celery.",
              {
                settingsLink: (
                  <ExternalLink href="https://docs.sentry.io/platforms/python/guides/django/#configure" />
                ),
                celeryDocsLinks: (
                  <ExternalLink href="https://docs.celeryq.dev/en/stable/django/first-steps-with-django.html" />
                ),
              }
            )}
          </p>
        </Fragment>
      ),
    },
  ],
  verify: () => [
    {
      type: StepType.VERIFY,
      description: (
        <Fragment>
          <p>
            {tct(
              "To verify if your SDK is initialized on worker start, you can pass [code:debug=True] to [code:sentry_sdk.init()] to see extra output when the SDK is initialized. If the output appears during worker startup and not only after a task has started, then it's working properly.",
              {
                code: <code />,
              }
            )}
          </p>
        </Fragment>
      ),
    },
  ],
};

const docs: Docs = {
  onboarding,

  crashReportOnboarding: crashReportOnboardingPython,
};

export default docs;

const CONTENT_SPACING = space(2);
const SpacedOnboardingCodeSnippet = styled(OnboardingCodeSnippet)`
  pre {
    margin-bottom: ${CONTENT_SPACING};
  }
`;
