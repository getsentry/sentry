import {Alert} from 'sentry/components/core/alert';
import {ExternalLink} from 'sentry/components/core/link';
import {
  StepType,
  type BasePlatformOptions,
  type ContentBlock,
  type DocsParams,
  type OnboardingConfig,
} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {t, tct} from 'sentry/locale';

function BrowserProfilingBetaWarning() {
  return (
    <Alert type="info" showIcon={false}>
      {tct(
        `Browser profiling is currently in Beta as we wait for the JS Self Profiling spec to gain wider support. You can read the detailed explanation [explainer].`,
        {
          explainer: (
            <a href="https://docs.sentry.io/platforms/javascript/profiling/">
              {t('here')}
            </a>
          ),
        }
      )}
    </Alert>
  );
}

const browserProfilingSnippet = (params: DocsParams) => `
Sentry.init({
  dsn: "${params.dsn.public}",
  integrations: [
    Sentry.browserTracingIntegration(),
    Sentry.browserProfilingIntegration()
  ],
  // Tracing
  tracesSampleRate: 1.0, //  Capture 100% of the transactions
  // Set 'tracePropagationTargets' to control for which URLs distributed tracing should be enabled
  tracePropagationTargets: ["localhost", /^https:\\/\\/yourserver\\.io\\/api/],
  // Set profileSessionSampleRate to 1.0 to profile during every session.
  // The decision, whether to profile or not, is made once per session (when the SDK is initialized).
  profileSessionSampleRate: 1.0
});`;

const getDefaultProfilingHeaderContent = (): ContentBlock[] => [
  {
    type: 'text',
    text: tct(
      "How you do this will depend on your server. If you're using a server like Express, you'll be able to use the [link:response.set] function.",
      {
        link: <ExternalLink href="https://expressjs.com/en/4x/api.html#res.set" />,
      }
    ),
  },
  {
    type: 'code',
    tabs: [
      {
        label: 'JavaScript',
        language: 'javascript',
        code: `
app.get("/", (request, response) => {
response.set("Document-Policy", "js-profiling");
response.sendFile("index.html");
});
        `,
      },
    ],
  },
];

export const profiling = <
  PlatformOptions extends BasePlatformOptions = BasePlatformOptions,
>({
  installSnippetBlock,
  docsLink,
}: {
  docsLink: string;
  installSnippetBlock: ContentBlock;
}): OnboardingConfig<PlatformOptions> => ({
  introduction: () => <BrowserProfilingBetaWarning />,
  install: () => [
    {
      type: StepType.INSTALL,
      content: [
        {
          type: 'text',
          text: tct(
            'Install our SDK using your preferred package manager, the minimum version that supports profiling is [code:7.60.0].',
            {
              code: <code />,
            }
          ),
        },
        installSnippetBlock,
      ],
    },
  ],
  configure: params => [
    {
      title: t('Add Document-Policy: js-profiling header'),
      content: [
        {
          type: 'text',
          text: tct(
            'For the JavaScript browser profiler to start, the document response header needs to include a [code:Document-Policy] header key with the [code:js-profiling] value.',
            {
              code: <code />,
            }
          ),
        },
        ...getDefaultProfilingHeaderContent(),
      ],
    },
    {
      type: StepType.CONFIGURE,
      content: [
        {
          type: 'text',
          text: tct(
            'Set up the [code:browserTracingIntegration] and [code:browserProfilingIntegration] in your [code:Sentry.init()] call.',
            {
              code: <code />,
            }
          ),
        },
        {
          type: 'code',
          tabs: [
            {
              label: 'Javascript',
              value: 'javascript',
              language: 'javascript',
              code: browserProfilingSnippet(params),
            },
          ],
        },
        {
          type: 'text',
          text: tct(
            'For more detailed information, see the [link:browser profiling documentation].',
            {
              link: <ExternalLink href={docsLink} />,
            }
          ),
        },
      ],
    },
  ],
  verify: () => [
    {
      type: StepType.VERIFY,
      content: [
        {
          type: 'text',
          text: t(
            'Verify that profiling is working correctly by simply using your application.'
          ),
        },
      ],
    },
  ],
});

export const profilingFullStack = <
  PlatformOption extends BasePlatformOptions = BasePlatformOptions,
>({
  packageName,
  browserProfilingLink,
  nodeProfilingLink,
  getProfilingHeaderContent = getDefaultProfilingHeaderContent,
}: {
  browserProfilingLink: string;
  nodeProfilingLink: string;
  packageName: `@sentry/${string}`;
  getProfilingHeaderContent?: (params: DocsParams) => ContentBlock[];
}): OnboardingConfig<PlatformOption> => ({
  install: () => [
    {
      type: StepType.INSTALL,
      content: [
        {
          type: 'text',
          text: tct(
            'To enable profiling, add [code:@sentry/profiling-node] to your imports and make sure [packageName] is up-to-date. The minimum version of [packageName] that supports node and browser profiling is [code:7.60.0].',
            {
              code: <code />,
              packageName: <code>{packageName}</code>,
            }
          ),
        },
        {
          type: 'code',
          tabs: [
            {
              label: 'npm',
              language: 'bash',
              code: `npm install ${packageName} @sentry/profiling-node --save`,
            },
            {
              label: 'yarn',
              language: 'bash',
              code: `yarn add ${packageName} @sentry/profiling-node`,
            },
            {
              label: 'pnpm',
              language: 'bash',
              code: `pnpm add ${packageName} @sentry/profiling-node`,
            },
          ],
        },
      ],
    },
  ],
  configure: params => [
    {
      title: t('Configure Node Profiling'),
      content: [
        {
          type: 'text',
          text: tct(
            'Set up the [code:nodeProfilingIntegration] in your server-side [code:Sentry.init()] call.',
            {
              code: <code />,
            }
          ),
        },
        {
          type: 'code',
          tabs: [
            {
              label: 'Javascript',
              language: 'javascript',
              code: `
  const { nodeProfilingIntegration } = require("@sentry/profiling-node");

  Sentry.init({
  dsn: "${params.dsn.public}",
  integrations: [
    nodeProfilingIntegration(),
  ],
  // Tracing must be enabled for profiling to work
  tracesSampleRate: 1.0, //  Capture 100% of the transactions${
    params.profilingOptions?.defaultProfilingMode === 'continuous'
      ? `
  // Set sampling rate for profiling - this is evaluated only once per SDK.init call
  profileSessionSampleRate: 1.0,
  // Trace lifecycle automatically enables profiling during active traces
  profileLifecycle: 'trace',`
      : `
  // Set sampling rate for profiling - this is evaluated only once per SDK.init call
  profilesSampleRate: 1.0,`
  }
  });${
    params.profilingOptions?.defaultProfilingMode === 'continuous'
      ? `

  // Profiling happens automatically after setting it up with \`Sentry.init()\`.
  // All spans (unless those discarded by sampling) will have profiling data attached to them.
  Sentry.startSpan({
  name: "My Span",
  }, () => {
  // The code executed here will be profiled
  });`
      : ''
  }`,
            },
          ],
        },
        {
          type: 'text',
          text: tct('For more information see the [link:node profiling documentation].', {
            link: <ExternalLink href={`${nodeProfilingLink}`} />,
          }),
        },
      ],
    },
    {
      title: t('Configure Browser Profiling'),
      content: [
        {
          type: 'custom',
          content: <BrowserProfilingBetaWarning />,
        },
        {
          type: 'text',
          text: tct(
            'Set up the [code:browserProfilingIntegration] in your client-side [code:Sentry.init()] call.',
            {
              code: <code />,
            }
          ),
        },
        {
          type: 'code',
          tabs: [
            {
              label: 'Javascript',
              language: 'javascript',
              code: browserProfilingSnippet(params),
            },
          ],
        },
        {
          type: 'text',
          text: tct(
            'For the JavaScript browser profiler to start, the document response header needs to include a [code:Document-Policy] header key with the [code:js-profiling] value.',
            {
              code: <code />,
            }
          ),
        },
        ...getProfilingHeaderContent(params),
        {
          type: 'text',
          text: tct(
            'For more detailed information, see the [link:browser profiling documentation].',
            {
              link: <ExternalLink href={browserProfilingLink} />,
            }
          ),
        },
      ],
    },
  ],
  verify: () => [
    {
      type: StepType.VERIFY,
      content: [
        {
          type: 'text',
          text: t(
            'Verify that profiling is working correctly by simply using your application.'
          ),
        },
      ],
    },
  ],
});
