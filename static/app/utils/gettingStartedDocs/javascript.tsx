import {Alert} from 'sentry/components/core/alert';
import {ExternalLink} from 'sentry/components/core/link';
import {
  StepType,
  type BasePlatformOptions,
  type Configuration,
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
  // Set profilesSampleRate to 1.0 to profile every transaction.
  // Since profilesSampleRate is relative to tracesSampleRate,
  // the final profiling rate can be computed as tracesSampleRate * profilesSampleRate
  // For example, a tracesSampleRate of 0.5 and profilesSampleRate of 0.5 would
  // results in 25% of transactions being profiled (0.5*0.5=0.25)
  profilesSampleRate: 1.0
});`;

const getDefaultProfilingHeaderConfig = () => [
  {
    description: tct(
      "How you do this will depend on your server. If you're using a server like Express, you'll be able to use the [link:response.set] function.",
      {
        link: <ExternalLink href="https://expressjs.com/en/4x/api.html#res.set" />,
      }
    ),
    language: 'javascript',
    code: [
      {
        label: 'JavaScript',
        value: 'javascript',
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

export const getJavascriptProfilingOnboarding = <
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
      description: tct(
        'For the JavaScript browser profiler to start, the document response header needs to include a [code:Document-Policy] header key with the [code:js-profiling] value.',
        {
          code: <code />,
        }
      ),
      configurations: getDefaultProfilingHeaderConfig(),
    },
    {
      type: StepType.CONFIGURE,
      description: tct(
        'Set up the [code:browserTracingIntegration] and [code:browserProfilingIntegration] in your [code:Sentry.init()] call.',
        {
          code: <code />,
        }
      ),
      configurations: [
        {
          language: 'javascript',
          code: [
            {
              label: 'Javascript',
              value: 'javascript',
              language: 'javascript',
              code: browserProfilingSnippet(params),
            },
          ],
        },
        {
          description: tct(
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
      description: t(
        'To confirm that profiling is working correctly, run your application and check the Sentry profiles page for the collected profiles.'
      ),
    },
  ],
});

export const getJavascriptLogsOnboarding = <
  PlatformOptions extends BasePlatformOptions = BasePlatformOptions,
>({
  docsPlatform,
  sdkPackage,
  installSnippetBlock,
}: {
  docsPlatform: string;
  installSnippetBlock: ContentBlock;
  sdkPackage: `@sentry/${string}`;
}): OnboardingConfig<PlatformOptions> => ({
  install: () => [
    {
      type: StepType.INSTALL,
      content: [
        {
          type: 'text',
          text: tct(
            'Add the Sentry SDK as a dependency. The minimum version of [sdkPackage] that supports logs is [code:9.41.0].',
            {
              code: <code />,
              sdkPackage: <code>{sdkPackage}</code>,
            }
          ),
        },
        installSnippetBlock,
        {
          type: 'text',
          text: tct(
            'If you are on an older version of the SDK, follow our [link:migration guide] to upgrade.',
            {
              link: (
                <ExternalLink
                  href={`https://docs.sentry.io/platforms/javascript/guides/${docsPlatform}/migration/`}
                />
              ),
            }
          ),
        },
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
            'Enable Sentry logs by adding [code:enableLogs: true] to your [code:Sentry.init()] configuration.',
            {code: <code />}
          ),
        },
        {
          type: 'code',
          language: 'javascript',
          code: `
import * as Sentry from "${sdkPackage}";

Sentry.init({
  dsn: "${params.dsn.public}",
  integrations: [
    // send console.log, console.warn, and console.error calls as logs to Sentry
    Sentry.consoleLoggingIntegration({ levels: ["log", "warn", "error"] }),
  ],
  // Enable logs to be sent to Sentry
  enableLogs: true,
});
`,
        },
        {
          type: 'text',
          text: tct('For more detailed information, see the [link:logs documentation].', {
            link: (
              <ExternalLink
                href={`https://docs.sentry.io/platforms/javascript/guides/${docsPlatform}/logs/`}
              />
            ),
          }),
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
          text: t('Send a test log from your app to verify logs are arriving in Sentry.'),
        },
        {
          type: 'code',
          language: 'jsx',
          code: `import * as Sentry from "${sdkPackage}";

Sentry.logger.info('User triggered test log', { log_source: 'sentry_test' })`,
        },
      ],
    },
  ],
});

export const getJavascriptLogsFullStackOnboarding = <
  PlatformOptions extends BasePlatformOptions = BasePlatformOptions,
>({
  docsPlatform,
  sdkPackage,
}: {
  docsPlatform: string;
  sdkPackage: `@sentry/${string}`;
}): OnboardingConfig<PlatformOptions> => ({
  install: () => [
    {
      type: StepType.INSTALL,
      content: [
        {
          type: 'text',
          text: tct(
            'To add logs make sure [sdkPackage] is up-to-date. The minimum version of [sdkPackage] that supports logs is [code:9.41.0].',
            {
              code: <code />,
              sdkPackage: <code>{sdkPackage}</code>,
            }
          ),
        },
        {
          type: 'code',
          language: 'bash',
          tabs: [
            {
              label: 'npm',
              value: 'npm',
              language: 'bash',
              code: `npm install ${sdkPackage} --save`,
            },
            {
              label: 'yarn',
              value: 'yarn',
              language: 'bash',
              code: `yarn add ${sdkPackage}`,
            },
            {
              label: 'pnpm',
              value: 'pnpm',
              language: 'bash',
              code: `pnpm add ${sdkPackage}`,
            },
          ],
        },
        {
          type: 'text',
          text: tct(
            'If you are on an older version of the SDK, follow our [link:migration guide] to upgrade.',
            {
              link: (
                <ExternalLink
                  href={`https://docs.sentry.io/platforms/javascript/guides/${docsPlatform}/migration/`}
                />
              ),
            }
          ),
        },
      ],
    },
  ],
  configure: params => [
    {
      type: StepType.CONFIGURE,
      content: [
        {
          type: 'text',
          text: tct(
            'Enable Sentry logs by adding [code:enableLogs: true] to your [code:Sentry.init()] configuration.',
            {code: <code />}
          ),
        },
        {
          type: 'code',
          language: 'javascript',
          code: `
import * as Sentry from "${sdkPackage}";

Sentry.init({
  dsn: "${params.dsn.public}",
  integrations: [
    // send console.log, console.warn, and console.error calls as logs to Sentry
    Sentry.consoleLoggingIntegration({ levels: ["log", "warn", "error"] }),
  ],
  // Enable logs to be sent to Sentry
  enableLogs: true,
});
`,
        },
        {
          type: 'text',
          text: tct('For more detailed information, see the [link:logs documentation].', {
            link: (
              <ExternalLink
                href={`https://docs.sentry.io/platforms/javascript/guides/${docsPlatform}/logs/`}
              />
            ),
          }),
        },
      ],
    },
  ],
  verify: () => [
    {
      type: StepType.VERIFY,
      description: t(
        'To confirm that logs are working correctly, run your application and check the Sentry logs page for the collected logs.'
      ),
      content: [
        {
          type: 'code',
          language: 'jsx',
          code: `import * as Sentry from "${sdkPackage}";

Sentry.logger.info('User triggered test log', { log_source: 'sentry_test' })`,
        },
      ],
    },
  ],
});

export const getJavascriptFullStackOnboarding = <
  PlatformOptions extends BasePlatformOptions = BasePlatformOptions,
>({
  basePackage,
  browserProfilingLink,
  nodeProfilingLink,
  getProfilingHeaderConfig = getDefaultProfilingHeaderConfig,
}: {
  basePackage: string;
  browserProfilingLink: string;
  nodeProfilingLink: string;
  getProfilingHeaderConfig?: (params: DocsParams) => Configuration[];
}): OnboardingConfig<PlatformOptions> => ({
  install: () => [
    {
      type: StepType.INSTALL,
      description: tct(
        'To enable profiling, add [code:@sentry/profiling-node] to your imports and make sure [packageCode] is up-to-date. The minimum version of [packageCode] that supports node and browser profiling is [code:7.60.0].',
        {
          code: <code />,
          packageCode: <code>{basePackage}</code>,
        }
      ),
      configurations: [
        {
          code: [
            {
              label: 'npm',
              value: 'npm',
              language: 'bash',
              code: `npm install ${basePackage} @sentry/profiling-node --save`,
            },
            {
              label: 'yarn',
              value: 'yarn',
              language: 'bash',
              code: `yarn add ${basePackage} @sentry/profiling-node`,
            },
            {
              label: 'pnpm',
              value: 'pnpm',
              language: 'bash',
              code: `pnpm add ${basePackage} @sentry/profiling-node`,
            },
          ],
        },
      ],
    },
  ],
  configure: params => [
    {
      title: t('Configure Node Profiling'),
      description: tct(
        'Set up the [code:nodeProfilingIntegration] in your server-side [code:Sentry.init()] call.',
        {
          code: <code />,
        }
      ),
      configurations: [
        {
          language: 'javascript',
          code: [
            {
              label: 'Javascript',
              value: 'javascript',
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
          description: tct(
            'For more information see the [link:node profiling documentation].',
            {
              link: <ExternalLink href={`${nodeProfilingLink}`} />,
            }
          ),
        },
      ],
    },
    {
      title: t('Configure Browser Profiling'),
      description: <BrowserProfilingBetaWarning />,
      configurations: [
        {
          description: tct(
            'Set up the [code:browserProfilingIntegration] in your client-side [code:Sentry.init()] call.',
            {
              code: <code />,
            }
          ),
          code: [
            {
              label: 'Javascript',
              value: 'javascript',
              language: 'javascript',
              code: browserProfilingSnippet(params),
            },
          ],
        },
        {
          description: tct(
            'For the JavaScript browser profiler to start, the document response header needs to include a [code:Document-Policy] header key with the [code:js-profiling] value.',
            {
              code: <code />,
            }
          ),
          configurations: getProfilingHeaderConfig(params),
        },
        {
          description: tct(
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
      description: t(
        'To confirm that profiling is working correctly, run your application and check the Sentry profiles page for the collected profiles.'
      ),
    },
  ],
});
