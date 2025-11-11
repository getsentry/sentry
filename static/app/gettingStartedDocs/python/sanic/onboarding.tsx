import {ExternalLink} from 'sentry/components/core/link';
import type {
  DocsParams,
  OnboardingConfig,
} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {StepType} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {metricsVerify} from 'sentry/gettingStartedDocs/python/python/metrics';
import {
  getPythonAiocontextvarsCodeBlocks,
  getPythonInstallCodeBlock,
} from 'sentry/gettingStartedDocs/python/python/utils';
import {t, tct} from 'sentry/locale';

const getSdkSetupSnippet = (params: DocsParams) => `from sanic import Sanic
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
    }
)
`;

export const onboarding: OnboardingConfig = {
  introduction: () =>
    tct('The Sanic integration adds support for the [link:Sanic Web Framework].', {
      link: <ExternalLink href="https://github.com/sanic-org/sanic" />,
    }),
  install: () => [
    {
      type: StepType.INSTALL,
      content: [
        {
          type: 'text',
          text: tct('Install [code:sentry-sdk] from PyPI with the [code:sanic] extra:', {
            code: <code />,
          }),
        },
        getPythonInstallCodeBlock({packageName: 'sentry-sdk[sanic]'}),
        ...getPythonAiocontextvarsCodeBlocks(),
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
            'If you have the [codeSanic:sanic] package in your dependencies, the Sanic integration will be enabled automatically when you initialize the Sentry SDK. Initialize the Sentry SDK before your app has been initialized:',
            {
              codeSanic: <code />,
            }
          ),
        },
        {
          type: 'code',
          language: 'python',
          code: `${getSdkSetupSnippet(params)}
app = Sanic(__name__)
`,
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
            'You can easily verify your Sentry installation by creating a route that triggers an error:'
          ),
        },
        {
          type: 'code',
          language: 'python',
          code: `from sanic.response import text
${getSdkSetupSnippet(params)}
app = Sanic(__name__)

@app.get("/")
async def hello_world(request):
    1 / 0  # raises an error
    return text("Hello, world.")
        `,
        },
        metricsVerify(params),
        {
          type: 'text',
          text: tct(
            'When you point your browser to [link:http://localhost:8000/] an error will be sent to Sentry.',
            {
              link: <ExternalLink href="http://localhost:8000/" />,
            }
          ),
        },
      ],
    },
  ],
  nextSteps: (params: DocsParams) => {
    const steps = [] as any[];
    if (params.isLogsSelected) {
      steps.push({
        id: 'logs',
        name: t('Logging Integrations'),
        description: t(
          'Add logging integrations to automatically capture logs from your application.'
        ),
        link: 'https://docs.sentry.io/platforms/python/logs/#integrations',
      });
    }
    return steps;
  },
};
