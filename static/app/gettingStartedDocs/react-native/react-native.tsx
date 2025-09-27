import {ExternalLink} from 'sentry/components/core/link';
import type {
  BasePlatformOptions,
  ContentBlock,
  Docs,
  DocsParams,
  OnboardingConfig,
} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {StepType} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {
  getCrashReportApiIntroduction,
  getCrashReportInstallDescription,
  getFeedbackConfigOptions,
  getFeedbackConfigureMobileDescription,
} from 'sentry/components/onboarding/gettingStartedDoc/utils/feedbackOnboarding';
import {
  getReplayMobileConfigureDescription,
  getReplayVerifyStep,
} from 'sentry/components/onboarding/gettingStartedDoc/utils/replayOnboarding';
import {t, tct} from 'sentry/locale';

export enum InstallationMode {
  AUTO = 'auto',
  MANUAL = 'manual',
}

const platformOptions = {
  installationMode: {
    label: t('Installation Mode'),
    items: [
      {
        label: t('Auto'),
        value: InstallationMode.AUTO,
      },
      {
        label: t('Manual'),
        value: InstallationMode.MANUAL,
      },
    ],
    defaultValue: InstallationMode.AUTO,
  },
} satisfies BasePlatformOptions;

type PlatformOptions = typeof platformOptions;
type Params = DocsParams<PlatformOptions>;

const isAutoInstall = (params: Params) =>
  params.platformOptions?.installationMode === InstallationMode.AUTO;

const installCodeBlock: ContentBlock = {
  type: 'code',
  tabs: [
    {
      label: 'npm',
      language: 'bash',
      code: `npm install @sentry/react-native --save`,
    },
    {
      label: 'yarn',
      language: 'bash',
      code: `yarn add @sentry/react-native`,
    },
    {
      label: 'pnpm',
      language: 'bash',
      code: `pnpm add @sentry/react-native`,
    },
  ],
};

const getConfigureSnippet = (params: Params) => `
import * as Sentry from "@sentry/react-native";

Sentry.init({
  dsn: "${params.dsn.public}",
  // Adds more context data to events (IP address, cookies, user, etc.)
  // For more information, visit: https://docs.sentry.io/platforms/react-native/data-management/data-collected/
  sendDefaultPii: true,${
    params.isPerformanceSelected
      ? `
  // Set tracesSampleRate to 1.0 to capture 100% of transactions for tracing.
  // We recommend adjusting this value in production.
  tracesSampleRate: 1.0,`
      : ''
  }${
    params.isProfilingSelected
      ? `
  // profilesSampleRate is relative to tracesSampleRate.
  // Here, we'll capture profiles for 100% of transactions.
  profilesSampleRate: 1.0,`
      : ''
  }${
    params.isReplaySelected
      ? `
  // Record Session Replays for 10% of Sessions and 100% of Errors
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,
  integrations: [Sentry.mobileReplayIntegration()],`
      : ''
  }${
    params.isLogsSelected
      ? `
  // Enable logs to be sent to Sentry
  // Learn more at https://docs.sentry.io/platforms/react-native/logs/
  enableLogs: true,`
      : ''
  }
});`;

const getPerformanceSnippet = () => `
// Let's say this function is invoked when a user clicks on the checkout button of your shop
shopCheckout() {
  // This will create a new Transaction for you
  const transaction = Sentry.startTransaction({ name: "shopCheckout" });
  // Set transaction on scope to associate with errors and get included span instrumentation
  // If there's currently an unfinished transaction, it may be dropped
  Sentry.getCurrentHub().configureScope(scope => scope.setSpan(transaction));

  // Assume this function makes an xhr/fetch call
  const result = validateShoppingCartOnServer();

  const span = transaction.startChild({
    data: {
      result
    },
    op: 'task',
    description: "processing shopping cart result",
  });
  try {
    processAndValidateShoppingCart(result);
    span.setStatus(SpanStatus.Ok);
  } catch (err) {
    span.setStatus(SpanStatus.UnknownError);
    throw err;
  } finally {
    span.finish();
    transaction.finish();
  }
}`;

const getReplaySetupSnippet = (params: Params) => `
import * as Sentry from '@sentry/react-native';

Sentry.init({
  dsn: "${params.dsn.public}",
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,
  integrations: [
    Sentry.mobileReplayIntegration(),
  ],
});`;

const getReplayConfigurationSnippet = () => `
Sentry.mobileReplayIntegration({
  maskAllText: true,
  maskAllImages: true,
  maskAllVectors: true,
}),`;

const getFeedbackConfigureSnippet = (params: Params) => `
import * as Sentry from "@sentry/react-native";

Sentry.init({
  dsn: "${params.dsn.public}",
  integrations: [
    Sentry.feedbackIntegration({
      // Additional SDK configuration goes in here, for example:
      styles: {
        submitButton: {
          backgroundColor: "#6a1b9a",
        },
      },
      namePlaceholder: "Fullname",
      ${getFeedbackConfigOptions(params.feedbackOptions)}
    }),
  ],
});
`;

const profilingOnboarding: OnboardingConfig = {
  install: () => [
    {
      title: t('Install'),
      content: [
        {
          type: 'text',
          text: t(
            'Make sure your Sentry React Native SDK version is at least 5.32.0. If you already have the SDK installed, you can update it to the latest version with:'
          ),
        },
        installCodeBlock,
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
            'Enable Tracing and Profiling by adding [code:tracesSampleRate] and [code:profilesSampleRate] to your [code:Sentry.init()] call.',
            {
              code: <code />,
            }
          ),
        },
        {
          type: 'code',
          language: 'javascript',
          code: getConfigureSnippet({
            ...params,
            platformOptions: {
              ...params.platformOptions,
              installationMode: InstallationMode.MANUAL,
            },
            isProfilingSelected: true,
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
          text: t(
            'Verify that profiling is working correctly by simply using your application.'
          ),
        },
      ],
    },
  ],
};

const feedbackOnboarding: OnboardingConfig<PlatformOptions> = {
  install: () => [
    {
      type: StepType.INSTALL,
      content: [
        {
          type: 'text',
          text: t(
            "If you're using a self-hosted Sentry instance, you'll need to be on version 24.4.2 or higher in order to use the full functionality of the User Feedback feature. Lower versions may have limited functionality."
          ),
        },
        {
          type: 'text',
          text: tct(
            'To collect user feedback from inside your application, use the [code:showFeedbackWidget] method.',
            {code: <code />}
          ),
        },
        {
          type: 'code',
          tabs: [
            {
              label: 'JavaScript',
              language: 'javascript',
              code: `import * as Sentry from "@sentry/react-native";

Sentry.wrap(RootComponent);
Sentry.showFeedbackWidget();`,
            },
          ],
        },
        {
          type: 'text',
          text: tct(
            'You may also use the [code:showFeedbackButton] and [code:hideFeedbackButton] to show and hide a button that opens the Feedback Widget.',
            {
              code: <code />,
            }
          ),
        },
        {
          type: 'code',
          tabs: [
            {
              label: 'JavaScript',
              language: 'javascript',
              code: `import * as Sentry from "@sentry/react-native";

Sentry.wrap(RootComponent);

Sentry.showFeedbackWidget();
Sentry.hideFeedbackButton();`,
            },
          ],
        },
      ],
    },
  ],
  configure: (params: Params) => [
    {
      type: StepType.CONFIGURE,
      content: [
        {
          type: 'text',
          text: getFeedbackConfigureMobileDescription({
            linkConfig:
              'https://docs.sentry.io/platforms/react-native/user-feedback/configuration/',
            linkButton:
              'https://docs.sentry.io/platforms/react-native/user-feedback/configuration/#feedback-button-customization',
          }),
        },
        {
          type: 'code',
          tabs: [
            {
              label: 'JavaScript',
              language: 'javascript',
              code: getFeedbackConfigureSnippet(params),
            },
          ],
        },
      ],
    },
  ],
  verify: () => [],
  nextSteps: () => [],
};

const onboarding: OnboardingConfig<PlatformOptions> = {
  install: params =>
    isAutoInstall(params)
      ? [
          {
            type: StepType.INSTALL,
            content: [
              {
                type: 'text',
                text: tct(
                  'Run [code:@sentry/wizard] to automatically configure your project:',
                  {code: <code />}
                ),
              },
              {
                type: 'code',
                tabs: [
                  {
                    label: 'npx',
                    language: 'bash',
                    code: `npx @sentry/wizard@latest -i reactNative ${params.isSelfHosted ? '' : '--saas'} --org ${params.organization.slug} --project ${params.project.slug}`,
                  },
                ],
              },
              {
                type: 'text',
                text: t(
                  'The Sentry wizard will automatically patch your project with the following:'
                ),
              },
              {
                type: 'list',
                items: [
                  t('Configure the SDK with your DSN'),
                  t('Add source maps upload to your build process'),
                  t('Add debug symbols upload to your build process'),
                ],
              },
            ],
          },
        ]
      : [
          {
            title: t('Install SDK Package'),
            content: [
              {
                type: 'text',
                text: t('Install the @sentry/react-native package:'),
              },
              installCodeBlock,
            ],
          },
        ],
  configure: params =>
    isAutoInstall(params)
      ? []
      : [
          {
            type: StepType.CONFIGURE,
            content: [
              {
                type: 'conditional',
                condition: params.isProfilingSelected,
                content: [
                  {
                    type: 'text',
                    text: t(
                      'React Native Profiling is available since SDK version 5.32.0.'
                    ),
                  },
                ],
              },
              {
                type: 'code',
                language: 'javascript',
                code: getConfigureSnippet(params),
              },
              {
                type: 'text',
                text: tct(
                  'Wrap your app with Sentry to automatically instrument it with [touchEventTrakingLink:touch event tracking] and [automaticPerformanceMonitoringLink:automatic tracing]:',
                  {
                    touchEventTrakingLink: (
                      <ExternalLink href="https://docs.sentry.io/platforms/react-native/touchevents/" />
                    ),
                    automaticPerformanceMonitoringLink: (
                      <ExternalLink href="https://docs.sentry.io/platforms/react-native/tracing/instrumentation/automatic-instrumentation/" />
                    ),
                  }
                ),
              },
              {
                type: 'code',
                language: 'javascript',
                code: 'export default Sentry.wrap(App);',
              },
              {
                type: 'text',
                text: t(
                  'You do not need to do this for Sentry to work or if your app does not have a single parent "App" component.'
                ),
              },
            ],
          },
        ],
  verify: params =>
    isAutoInstall(params)
      ? []
      : [
          {
            type: StepType.VERIFY,
            content: [
              {
                type: 'text',
                text: t(
                  'Then create an intentional error, so you can test that everything is working:'
                ),
              },
              {
                type: 'code',
                language: 'javascript',
                code: "throw new Error('My first Sentry error!');",
              },
              {
                type: 'text',
                text: t('Or, try a native crash with:'),
              },
              {
                type: 'code',
                language: 'javascript',
                code: 'Sentry.nativeCrash();',
              },
              {
                type: 'text',
                text: [
                  t(
                    "If you're new to Sentry, use the email alert to access your account and complete a product tour."
                  ),
                  t(
                    "If you're an existing user and have disabled alerts, you won't receive this email."
                  ),
                ],
              },
              {
                type: 'conditional',
                condition: params.isPerformanceSelected,
                content: [
                  {
                    type: 'subheader',
                    text: t('Tracing'),
                  },
                  {
                    type: 'text',
                    text: t(
                      'Sentry can measure the performance of your app automatically when instrumented with the following routers:'
                    ),
                  },
                  {
                    type: 'list',
                    items: [
                      <ExternalLink
                        key="react-navigation"
                        href="https://docs.sentry.io/platforms/react-native/tracing/instrumentation/react-navigation/"
                      >
                        {t('React Navigation')}
                      </ExternalLink>,
                      <ExternalLink
                        key="react-navigation-v4"
                        href="https://docs.sentry.io/platforms/react-native/tracing/instrumentation/react-navigation-v4/"
                      >
                        {t('React Navigation V4 and prior')}
                      </ExternalLink>,
                      <ExternalLink
                        key="react-native-navigation"
                        href="https://docs.sentry.io/platforms/react-native/tracing/instrumentation/react-native-navigation/"
                      >
                        {t('React Native Navigation')}
                      </ExternalLink>,
                      <ExternalLink
                        key="expo-router"
                        href="https://docs.sentry.io/platforms/react-native/tracing/instrumentation/expo-router/"
                      >
                        {t('Expo Router')}
                      </ExternalLink>,
                    ],
                  },
                  {
                    type: 'text',
                    text: t(
                      'Additionally, you can create transactions and spans programatically:'
                    ),
                  },
                  {
                    type: 'text',
                    text: t('For example:'),
                  },
                  {
                    type: 'code',
                    language: 'javascript',
                    code: getPerformanceSnippet(),
                  },
                  {
                    type: 'text',
                    text: tct(
                      'For more information, please refer to the [docLink: Sentry React Native documentation].',
                      {
                        docLink: (
                          <ExternalLink href="https://docs.sentry.io/platforms/react-native/tracing/instrumentation/" />
                        ),
                      }
                    ),
                  },
                ],
              },
            ],
          },
          {
            title: t('Debug Symbols'),
            content: [
              {
                type: 'text',
                text: [
                  t(
                    'We offer a range of methods to provide Sentry with debug symbols so that you can see symbolicated stack traces and triage issues faster.'
                  ),
                  tct(
                    "Complete stack traces will be shown for React Native Javascript errors by default using Sentry's [automaticSourceMapsUploadLink:automatic source maps upload]. To set up manual source maps upload follow [guideLink:this guide].",
                    {
                      automaticSourceMapsUploadLink: (
                        <ExternalLink href="https://docs.sentry.io/platforms/react-native/sourcemaps/" />
                      ),
                      guideLink: (
                        <ExternalLink href="https://docs.sentry.io/platforms/react-native/sourcemaps/" />
                      ),
                    }
                  ),
                ],
              },
              {
                type: 'text',
                text: tct(
                  "You'll also need to upload [debugSymbolsLink:Debug Symbols] generated by the native iOS and Android tooling for native crashes.",
                  {
                    debugSymbolsLink: (
                      <ExternalLink href="https://docs.sentry.io/platforms/react-native/upload-debug/" />
                    ),
                  }
                ),
              },
            ],
          },
          {
            title: t('Source Context'),
            content: [
              {
                type: 'text',
                text: tct(
                  "If Sentry has access to your application's source code, it can show snippets of code [italic:(source context)] around the location of stack frames, which helps to quickly pinpoint problematic code.",
                  {
                    italic: <i />,
                  }
                ),
              },
              {
                type: 'text',
                text: tct(
                  'Source Context will be shown for React Native Javascript error by default if source maps are uploaded. To set up source maps upload, follow the [sourceMapsGuideLink:Source Maps guide].',
                  {
                    sourceMapsGuideLink: (
                      <ExternalLink href="https://docs.sentry.io/platforms/react-native/sourcemaps/" />
                    ),
                  }
                ),
              },
              {
                type: 'text',
                text: tct(
                  "To enable source context for native errors, you'll need to upload native debug symbols to Sentry by following the instructions at [uploadWithGradleLink:Uploading Source Code Context With Sentry Gradle Plugin] and Uploading Source Context With Xcode.",
                  {
                    uploadWithGradleLink: (
                      <ExternalLink href="https://docs.sentry.io/platforms/react-native/upload-debug/#uploading-source-context-with-sentry-gradle-plugin" />
                    ),
                    uploadWithXCodeLink: (
                      <ExternalLink href="https://docs.sentry.io/platforms/react-native/upload-debug/#uploading-source-context-with-xcode" />
                    ),
                  }
                ),
              },
            ],
          },
        ],
  nextSteps: params =>
    // i am abusing the isAutoInstall because i was tired of fighting with the Next Steps type definition
    isAutoInstall(params)
      ? [
          {
            name: t('React Navigation'),
            description: t('Set up automatic instrumentation with React Navigation'),
            link: 'https://docs.sentry.io/platforms/react-native/tracing/instrumentation/react-navigation/',
          },
          {
            name: t('React Native Navigation'),
            description: t(
              'Set up automatic instrumentation with React Native Navigation'
            ),
            link: 'https://docs.sentry.io/platforms/react-native/tracing/instrumentation/react-native-navigation/',
          },
          {
            name: t('Expo Router'),
            description: t('Set up automatic instrumentation with Expo Router'),
            link: 'https://docs.sentry.io/platforms/react-native/tracing/instrumentation/expo-router/',
          },
        ]
      : [],
};

const feedbackOnboardingCrashApi: OnboardingConfig = {
  introduction: () => getCrashReportApiIntroduction(),
  install: () => [
    {
      type: StepType.INSTALL,
      content: [
        {
          type: 'text',
          text: getCrashReportInstallDescription(),
        },
        {
          type: 'code',
          tabs: [
            {
              label: 'TypeScript',
              language: 'typescript',
              code: `import * as Sentry from "@sentry/react-native";
import { UserFeedback } from "@sentry/react-native";

const sentryId = Sentry.captureMessage("My Message");
// OR: const sentryId = Sentry.lastEventId();

const userFeedback: UserFeedback = {
  event_id: sentryId,
  name: "John Doe",
  email: "john@doe.com",
  comments: "Hello World!",
};

Sentry.captureUserFeedback(userFeedback);`,
            },
          ],
        },
      ],
    },
  ],
  configure: () => [],
  verify: () => [],
  nextSteps: () => [],
};

const replayOnboarding: OnboardingConfig<PlatformOptions> = {
  install: (params: DocsParams<PlatformOptions>) => [
    {
      type: StepType.INSTALL,
      content: [
        {
          type: 'text',
          text: t(
            'Make sure your Sentry React Native SDK version is at least 6.5.0. If you already have the SDK installed, you can update it to the latest version with:'
          ),
        },
        {
          type: 'code',
          tabs: [
            {
              label: 'npm',
              language: 'bash',
              code: `npm install @sentry/react-native --save`,
            },
            {
              label: 'yarn',
              language: 'bash',
              code: `yarn add @sentry/react-native`,
            },
            {
              label: 'pnpm',
              language: 'bash',
              code: `pnpm add @sentry/react-native`,
            },
          ],
        },
        {
          type: 'text',
          text: t(
            'To set up the integration, add the following to your Sentry initialization:'
          ),
        },
        {
          type: 'code',
          tabs: [
            {
              label: 'JavaScript',
              language: 'javascript',
              code: getReplaySetupSnippet(params),
            },
          ],
        },
      ],
    },
  ],
  configure: () => [
    {
      type: StepType.CONFIGURE,
      content: [
        {
          type: 'text',
          text: getReplayMobileConfigureDescription({
            link: 'https://docs.sentry.io/platforms/react-native/session-replay/#privacy',
          }),
        },
        {
          type: 'text',
          text: t(
            'The following code is the default configuration, which masks and blocks everything.'
          ),
        },
        {
          type: 'code',
          tabs: [
            {
              label: 'JavaScript',
              language: 'javascript',
              code: getReplayConfigurationSnippet(),
            },
          ],
        },
      ],
    },
  ],
  verify: getReplayVerifyStep(),
  nextSteps: () => [],
};

const docs: Docs<PlatformOptions> = {
  onboarding,
  feedbackOnboardingNpm: feedbackOnboarding,
  crashReportOnboarding: feedbackOnboardingCrashApi,
  replayOnboarding,
  platformOptions,
  profilingOnboarding,
};

export default docs;
