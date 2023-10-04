import ExternalLink from 'sentry/components/links/externalLink';
import {Layout, LayoutProps} from 'sentry/components/onboarding/gettingStartedDoc/layout';
import {ModuleProps} from 'sentry/components/onboarding/gettingStartedDoc/sdkDocumentation';
import {StepType} from 'sentry/components/onboarding/gettingStartedDoc/step';
import {ProductSolution} from 'sentry/components/onboarding/productSelection';
import {t, tct} from 'sentry/locale';

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
    {tct('The RQ integration adds support for the [link:RQ Job Queue System].', {
      link: <ExternalLink href="https://python-rq.org/" />,
    })}
  </p>
);

export const steps = ({
  sentryInitContent,
}: {
  sentryInitContent: string;
}): LayoutProps['steps'] => [
  {
    type: StepType.CONFIGURE,
    description: (
      <span>
        <p>
          {tct(
            'If you have the [codeRq:rq] package in your dependencies, the RQ integration will be enabled automatically when you initialize the Sentry SDK.',
            {
              codeRq: <code />,
            }
          )}
        </p>
        <p>
          {tct('Create a file called [code:mysettings.py] with the following content:', {
            code: <code />,
          })}
        </p>
      </span>
    ),
    configurations: [
      {
        language: 'python',
        code: `
# mysettings.py
import sentry_sdk

sentry_sdk.init(
${sentryInitContent}
)
      `,
      },
      {
        description: t('Start your worker with:'),
        language: 'shell',
        code: `
rq worker \
-c mysettings \  # module name of mysettings.py
--sentry-dsn="..."  # only necessary for RQ < 1.0
        `,
      },
    ],
    additionalInfo: (
      <p>
        {tct(
          'Generally, make sure that the call to [code:init] is loaded on worker startup, and not only in the module where your jobs are defined. Otherwise, the initialization happens too late and events might end up not being reported.',
          {code: <code />}
        )}
      </p>
    ),
  },
  {
    type: StepType.VERIFY,
    description: (
      <p>
        {' '}
        {tct(
          'To verify, create a simple job and a [code:main.py] script that enqueues the job in RQ, then start an RQ worker to run the job:',
          {
            code: <code />,
          }
        )}
      </p>
    ),
    configurations: [
      {
        description: <h5>{t('Job definition')}</h5>,
        language: 'python',
        code: `# jobs.py
def hello(name):
    1/0  # raises an error
    return "Hello %s!" % name
        `,
      },
      {
        description: <h5>{t('Settings for worker')}</h5>,
        language: 'python',
        code: `# mysettings.py
import sentry_sdk

# Sentry configuration for RQ worker processes
sentry_sdk.init(
${sentryInitContent}
)
        `,
      },
      {
        description: <h5>{t('Main Python Script')}</h5>,
        language: 'python',
        code: `# main.py
from redis import Redis
from rq import Queue

from jobs import hello

import sentry_sdk

# Sentry configuration for main.py process (same as above)
sentry_sdk.init(
${sentryInitContent}
)

q = Queue(connection=Redis())
with sentry_sdk.start_transaction(name="testing_sentry"):
    result = q.enqueue(hello, "World")
        `,
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
];
// Configuration End

export function GettingStartedWithRq({
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

export default GettingStartedWithRq;
