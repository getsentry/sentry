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
    {tct(
      'The AIOHTTP integration adds support for the [link:AIOHTTP-Server Web Framework].',
      {
        link: <ExternalLink href="https://docs.aiohttp.org/en/stable/web.html" />,
      }
    )}
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
        {tct('Install [code:sentry-sdk] from PyPI:', {
          code: <code />,
        })}
      </p>
    ),
    configurations: [
      {
        language: 'bash',
        code: '$ pip install --upgrade sentry-sdk',
      },
      {
        description: (
          <p>
            {tct(
              "If you're on Python 3.6, you also need the [code:aiocontextvars] package:",
              {
                code: <code />,
              }
            )}
          </p>
        ),
        language: 'bash',
        code: '$ pip install --upgrade aiocontextvars',
      },
    ],
  },
  {
    type: StepType.CONFIGURE,
    description: (
      <p>
        {tct(
          'If you have the [code:aiohttp] package in your dependencies, the AIOHTTO integration will be enabled automatically. There is nothing to do for you except initializing the Sentry SDK before initializing your application:',
          {
            code: <code />,
          }
        )}
      </p>
    ),
    configurations: [
      {
        language: 'python',
        code: `
from aiohttp import web

import sentry_sdk

sentry_sdk.init(
${sentryInitContent}
)

async def hello(request):
    return web.Response(text="Hello, world")

app = web.Application()
app.add_routes([web.get('/', hello)])

web.run_app(app)
      `,
      },
    ],
  },
  {
    type: StepType.VERIFY,
    description: t(
      'You can easily verify your Sentry installation by creating a route that triggers an error:'
    ),
    configurations: [
      {
        language: 'python',

        code: `
from aiohttp import web

sentry_sdk.init(
${sentryInitContent}
)

async def hello(request):
    1/0  # raises an error
    return web.Response(text="Hello, world")

app = web.Application()
app.add_routes([web.get('/', hello)])

web.run_app(app)`,
      },
    ],
    additionalInfo: (
      <span>
        <p>
          {tct(
            `When you point your browser to [localhostLInk:http://localhost:8080/] a transaction in the Performance section of Sentry will be created.`,
            {
              localhostLInk: <ExternalLink href="http://localhost:8080/" />,
            }
          )}
        </p>
        <p>
          {t(
            'Additionally, an error event will be sent to Sentry and will be connected to the transaction.'
          )}
        </p>
        <p>{t('It takes a couple of moments for the data to appear in Sentry.')}</p>
      </span>
    ),
  },
];
// Configuration End

export function GettingStartedWithAIOHTTP({
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

export default GettingStartedWithAIOHTTP;
