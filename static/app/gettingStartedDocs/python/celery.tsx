import {Fragment} from 'react';
import styled from '@emotion/styled';

import {Alert} from 'sentry/components/alert';
import {CodeSnippet} from 'sentry/components/codeSnippet';
import ExternalLink from 'sentry/components/links/externalLink';
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
        : ''
    }
)${
  params.isProfilingSelected &&
  params.profilingOptions?.defaultProfilingMode === 'continuous'
    ? `

# Manually call start_profiler and stop_profiler
# to profile the code in between
sentry_sdk.profiler.start_profiler()
# this code will be profiled
#
# Calls to stop_profiler are optional - if you don't stop the profiler, it will keep profiling
# your application until the process exits or stop_profiler is called.
sentry_sdk.profiler.stop_profiler()`
    : ''
}`;

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
                  'You need a minimum version [code:1.18.0] of the [code:sentry-python] SDK for the profiling feature.',
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
              <CodeSnippet dark language="python">
                {`import sentry_sdk
from celery import Celery, signals

app = Celery("myapp")

#@signals.worker_init.connect
@signals.celeryd_init.connect
def init_sentry(**_kwargs):
    sentry_sdk.init(...)  # same as above
                `}
              </CodeSnippet>
            </li>
          </ul>
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
            {t(
              "To verify if your SDK is initialized on worker start, you can pass `debug=True` to `sentry_sdk.init()` to see extra output when the SDK is initialized. If the output appears during worker startup and not only after a task has started, then it's working properly."
            )}
          </p>
          <StyledAlert margin={false} type="info">
            {tct(
              `Sentry uses custom message headers for distributed tracing. For Celery versions 4.x, with [celeryDocLink: message protocol of version 1], this functionality is broken, and Celery fails to propagate custom headers to the worker. Protocol version 2, which is the default since Celery version 4.0, is not affected.

              The fix for the custom headers propagation issue was introduced to Celery project ([celeryPRLink: PR]) starting with version 5.0.1. However, the fix was not backported to versions 4.x.
              `,
              {
                celeryDocLink: (
                  <ExternalLink href="https://docs.celeryq.dev/en/stable/internals/protocol.html#version-1" />
                ),
                celeryPRLink: (
                  <ExternalLink href="https://github.com/celery/celery/pull/6374" />
                ),
              }
            )}
          </StyledAlert>
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

const StyledAlert = styled(Alert)`
  margin-top: ${space(2)};
`;
