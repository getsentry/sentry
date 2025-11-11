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

const getInitCallSnippet = (params: DocsParams) => `
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

const getSdkSetupSnippet = (params: DocsParams) => `
import sentry_sdk

${getInitCallSnippet(params)}`;

const getStartWorkerSnippet = () => `
rq worker \\
-c mysettings \\  # module name of mysettings.py
--sentry-dsn="..."  # only necessary for RQ < 1.0`;

const getJobDefinitionSnippet = () => `
def hello(name):
    1/0  # raises an error
    return "Hello %s!" % name`;

const getWorkerSetupSnippet = (params: DocsParams) => `
import sentry_sdk

# Sentry configuration for RQ worker processes
${getInitCallSnippet(params)}`;

const getMainPythonScriptSetupSnippet = (params: DocsParams) => `
from redis import Redis
from rq import Queue

from jobs import hello

import sentry_sdk

#import { get } from 'lodash';
Sentry configuration for main.py process (same as above)
${getInitCallSnippet(params)}

q = Queue(connection=Redis())
with sentry_sdk.start_transaction(name="testing_sentry"):
    result = q.enqueue(hello, "World")`;

export const onboarding: OnboardingConfig = {
  introduction: () =>
    tct('The RQ integration adds support for the [link:RQ Job Queue System].', {
      link: <ExternalLink href="https://python-rq.org/" />,
    }),
  install: () => [
    {
      type: StepType.INSTALL,
      content: [
        {
          type: 'text',
          text: tct('Install [code:sentry-sdk] from PyPI with the [code:rq] extra:', {
            code: <code />,
          }),
        },
        getPythonInstallCodeBlock({packageName: 'sentry-sdk[rq]'}),
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
            'If you have the [codeRq:rq] package in your dependencies, the RQ integration will be enabled automatically when you initialize the Sentry SDK.',
            {
              codeRq: <code />,
            }
          ),
        },
        {
          type: 'text',
          text: tct(
            'Create a file called [code:mysettings.py] with the following content:',
            {
              code: <code />,
            }
          ),
        },
        {
          type: 'code',
          tabs: [
            {
              label: 'mysettings.py',
              language: 'python',
              code: getSdkSetupSnippet(params),
            },
          ],
        },
        {
          type: 'text',
          text: t('Start your worker with:'),
        },
        {
          type: 'code',
          language: 'shell',
          code: getStartWorkerSnippet(),
        },
        {
          type: 'text',
          text: tct(
            'Generally, make sure that the call to [code:init] is loaded on worker startup, and not only in the module where your jobs are defined. Otherwise, the initialization happens too late and events might end up not being reported.',
            {code: <code />}
          ),
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
          text: tct(
            'To verify, create a simple job and a [code:main.py] script that enqueues the job in RQ, then start an RQ worker to run the job:',
            {
              code: <code />,
            }
          ),
        },
        {
          type: 'subheader',
          text: t('Job definition'),
        },
        {
          type: 'code',
          tabs: [
            {
              language: 'python',
              label: 'jobs.py',
              code: getJobDefinitionSnippet(),
            },
          ],
        },
        {
          type: 'subheader',
          text: t('Settings for worker'),
        },
        {
          type: 'code',
          tabs: [
            {
              label: 'mysettings.py',
              language: 'python',
              code: getWorkerSetupSnippet(params),
            },
          ],
        },
        {
          type: 'subheader',
          text: t('Main Python Script'),
        },
        {
          type: 'code',
          tabs: [
            {
              label: 'main.py',
              language: 'python',
              code: getMainPythonScriptSetupSnippet(params),
            },
          ],
        },
        metricsVerify(params),
        {
          type: 'text',
          text: [
            tct(
              'When you run [code:python main.py] a transaction named [code:testing_sentry] in the Performance section of Sentry will be created.',
              {
                code: <code />,
              }
            ),
            tct(
              'If you run the RQ worker with [code:rq worker -c mysettings] a transaction for the execution of [code:hello()] will be created. Additionally, an error event will be sent to Sentry and will be connected to the transaction.',
              {
                code: <code />,
              }
            ),
            t('It takes a couple of moments for the data to appear in Sentry.'),
          ],
        },
      ],
    },
  ],
};
