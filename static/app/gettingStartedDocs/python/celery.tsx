import {Fragment} from 'react';
import styled from '@emotion/styled';

import Alert from 'sentry/components/alert';
import {CodeSnippet} from 'sentry/components/codeSnippet';
import ExternalLink from 'sentry/components/links/externalLink';
import {Layout, LayoutProps} from 'sentry/components/onboarding/gettingStartedDoc/layout';
import {ModuleProps} from 'sentry/components/onboarding/gettingStartedDoc/sdkDocumentation';
import {StepType} from 'sentry/components/onboarding/gettingStartedDoc/step';
import {ProductSolution} from 'sentry/components/onboarding/productSelection';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';

// Configuration Start
const performanceConfiguration = `    # Set traces_sample_rate to 1.0 to capture 100%
    # of transactions for performance monitoring.
    traces_sample_rate=1.0,`;

const profilingConfiguration = `    # Set profiles_sample_rate to 1.0 to profile 100%
    # of sampled transactions.
    # We recommend adjusting this value in production.
    profiles_sample_rate=1.0,`;

const introduction = (
  <p>
    {tct('The celery integration adds support for the [link:Celery Task Queue System].', {
      link: <ExternalLink href="https://docs.celeryq.dev/en/stable/" />,
    })}
  </p>
);

export const steps = ({
  sentryInitContent,
}: {
  sentryInitContent: string;
}): LayoutProps['steps'] => [
  {
    type: StepType.INSTALL,
    description: (
      <p>
        {tct('Install [code:sentry-sdk] from PyPI with the [code:celery] extra:', {
          code: <code />,
        })}
      </p>
    ),
    configurations: [
      {
        language: 'bash',
        code: 'pip install --upgrade sentry-sdk[celery]',
      },
    ],
  },
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
        code: `
import sentry_sdk

sentry_sdk.init(
${sentryInitContent}
)
      `,
      },
    ],
    additionalInfo: (
      <Fragment>
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
  {
    type: StepType.VERIFY,
    description: (
      <div>
        <p>
          {t(
            "To verify if your SDK is initialized on worker start, you can pass `debug=True` to `sentry_sdk.init()` to see extra output when the SDK is initialized. If the output appears during worker startup and not only after a task has started, then it's working properly."
          )}
        </p>
        <AlertWithMarginBottom type="info">
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
        </AlertWithMarginBottom>
      </div>
    ),
  },
];
// Configuration End

export function GettingStartedWithCelery({
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
      introduction={introduction}
      steps={steps({
        sentryInitContent: sentryInitContent.join('\n'),
      })}
      {...props}
    />
  );
}

export default GettingStartedWithCelery;

const AlertWithMarginBottom = styled(Alert)`
  margin-top: ${space(2)};
  margin-bottom: 0;
`;
