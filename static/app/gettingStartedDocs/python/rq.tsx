import {Fragment} from 'react';

import ExternalLink from 'sentry/components/links/externalLink';
import {StepType} from 'sentry/components/onboarding/gettingStartedDoc/step';
import {
  Docs,
  DocsParams,
  OnboardingConfig,
} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {getPythonMetricsOnboarding} from 'sentry/components/onboarding/gettingStartedDoc/utils/metricsOnboarding';
import {t, tct} from 'sentry/locale';

type Params = DocsParams;

const getInstallSnippet = () => `pip install --upgrade sentry-sdk[rq]`;

const getInitCallSnippet = (params: Params) => `
sentry_sdk.init(
  dsn="${params.dsn}",${
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
)`;

const getSdkSetupSnippet = (params: Params) => `
# mysettings.py
import sentry_sdk

${getInitCallSnippet(params)}`;

const getStartWorkerSnippet = () => `
rq worker \
-c mysettings \  # module name of mysettings.py
--sentry-dsn="..."  # only necessary for RQ < 1.0`;

const getJobDefinitionSnippet = () => `# jobs.py
def hello(name):
    1/0  # raises an error
    return "Hello %s!" % name`;

const getWorkerSetupSnippet = (params: Params) => `
# mysettings.py
import sentry_sdk

# Sentry configuration for RQ worker processes
${getInitCallSnippet(params)}`;

const getMainPythonScriptSetupSnippet = (params: Params) => `
# main.py
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

const onboarding: OnboardingConfig = {
  introduction: () =>
    tct('The RQ integration adds support for the [link:RQ Job Queue System].', {
      link: <ExternalLink href="https://python-rq.org/" />,
    }),
  install: () => [
    {
      type: StepType.INSTALL,
      description: tct(
        'Install [code:sentry-sdk] from PyPI with the [sentryRQCode:rq] extra:',
        {
          code: <code />,
          sentryRQCode: <code />,
        }
      ),
      configurations: [
        {
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
        <Fragment>
          <p>
            {tct(
              'If you have the [codeRq:rq] package in your dependencies, the RQ integration will be enabled automatically when you initialize the Sentry SDK.',
              {
                codeRq: <code />,
              }
            )}
          </p>
          <p>
            {tct(
              'Create a file called [code:mysettings.py] with the following content:',
              {
                code: <code />,
              }
            )}
          </p>
        </Fragment>
      ),
      configurations: [
        {
          language: 'python',
          code: getSdkSetupSnippet(params),
        },
        {
          description: t('Start your worker with:'),
          language: 'shell',
          code: getStartWorkerSnippet(),
        },
      ],
      additionalInfo: tct(
        'Generally, make sure that the call to [code:init] is loaded on worker startup, and not only in the module where your jobs are defined. Otherwise, the initialization happens too late and events might end up not being reported.',
        {code: <code />}
      ),
    },
  ],
  verify: params => [
    {
      type: StepType.VERIFY,
      description: tct(
        'To verify, create a simple job and a [code:main.py] script that enqueues the job in RQ, then start an RQ worker to run the job:',
        {
          code: <code />,
        }
      ),
      configurations: [
        {
          description: <h5>{t('Job definition')}</h5>,
          language: 'python',
          code: getJobDefinitionSnippet(),
        },
        {
          description: <h5>{t('Settings for worker')}</h5>,
          language: 'python',
          code: getWorkerSetupSnippet(params),
        },
        {
          description: <h5>{t('Main Python Script')}</h5>,
          language: 'python',
          code: getMainPythonScriptSetupSnippet(params),
        },
      ],
      additionalInfo: (
        <div>
          <p>
            {tct(
              'When you run [codeMain:python main.py] a transaction named [codeTrxName:testing_sentry] in the Performance section of Sentry will be created.',
              {
                codeMain: <code />,
                codeTrxName: <code />,
              }
            )}
          </p>
          <p>
            {tct(
              'If you run the RQ worker with [codeWorker:rq worker -c mysettings] a transaction for the execution of [codeFunction:hello()] will be created. Additionally, an error event will be sent to Sentry and will be connected to the transaction.',
              {
                codeWorker: <code />,
                codeFunction: <code />,
              }
            )}
          </p>
          <p>{t('It takes a couple of moments for the data to appear in Sentry.')}</p>
        </div>
      ),
    },
  ],
};

const docs: Docs = {
  onboarding,
  customMetricsOnboarding: getPythonMetricsOnboarding({
    installSnippet: getInstallSnippet(),
  }),
};

export default docs;
