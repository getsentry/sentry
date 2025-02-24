import {Fragment} from 'react';

import ExternalLink from 'sentry/components/links/externalLink';
import List from 'sentry/components/list/';
import ListItem from 'sentry/components/list/listItem';
import {StepType} from 'sentry/components/onboarding/gettingStartedDoc/step';
import type {
  BasePlatformOptions,
  Docs,
  DocsParams,
  OnboardingConfig,
} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {
  getCrashReportApiIntroduction,
  getCrashReportInstallDescription,
} from 'sentry/components/onboarding/gettingStartedDoc/utils/feedbackOnboarding';
import {
  getReplayMobileConfigureDescription,
  getReplayVerifyStep,
} from 'sentry/components/onboarding/gettingStartedDoc/utils/replayOnboarding';
import {t, tct} from 'sentry/locale';
import {getInstallConfig} from 'sentry/utils/gettingStartedDocs/reactNative';

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
    defaultValue:
      navigator.userAgent.indexOf('Win') !== -1
        ? InstallationMode.MANUAL
        : InstallationMode.AUTO,
  },
} satisfies BasePlatformOptions;

type PlatformOptions = typeof platformOptions;
type Params = DocsParams<PlatformOptions>;

const isAutoInstall = (params: Params) =>
  params.platformOptions?.installationMode === InstallationMode.AUTO;

const getConfigureSnippet = (params: Params) => `
import * as Sentry from "@sentry/react-native";

Sentry.init({
  dsn: "${params.dsn.public}",${
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

const onboarding: OnboardingConfig<PlatformOptions> = {
  install: params =>
    isAutoInstall(params)
      ? [
          {
            type: StepType.INSTALL,
            description: tct(
              'Run [code:@sentry/wizard] to automatically configure your project:',
              {code: <code />}
            ),
            configurations: [
              {
                language: 'bash',
                code: `npx @sentry/wizard@latest -s -i reactNative --org ${params.organization.slug} --project ${params.projectSlug}`,
              },
              {
                description: (
                  <Fragment>
                    <p>
                      {t(
                        'The Sentry wizard will automatically patch your project with the following:'
                      )}
                    </p>
                    <List symbol="bullet">
                      <ListItem>
                        {t(
                          'Configure the SDK with your DSN and performance monitoring options'
                        )}
                      </ListItem>
                      <ListItem>
                        {t('Add source maps upload to your build process')}
                      </ListItem>
                      <ListItem>
                        {t('Add debug symbols upload to your build process')}
                      </ListItem>
                    </List>
                  </Fragment>
                ),
              },
            ],
          },
        ]
      : [
          {
            title: t('Install SDK Package'),
            description: t('Install the @sentry/react-native package:'),
            configurations: getInstallConfig(params, {
              basePackage: '@sentry/react-native',
              additionalPackages: [],
            }),
          },
        ],
  configure: params =>
    isAutoInstall(params)
      ? []
      : [
          {
            type: StepType.CONFIGURE,
            configurations: [
              ...(params.isProfilingSelected
                ? [
                    {
                      description: t(
                        'React Native Profiling is available since SDK version 5.32.0.'
                      ),
                    },
                  ]
                : []),
              {
                language: 'javascript',
                code: getConfigureSnippet(params),
                additionalInfo: tct(
                  'The "sentry-wizard" will try to add it to your [code:App.tsx]',
                  {
                    code: <code />,
                  }
                ),
              },
              {
                language: 'javascript',
                description: tct(
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
                code: 'export default Sentry.wrap(App);',
                additionalInfo: t(
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
            description: t(
              'Then create an intentional error, so you can test that everything is working:'
            ),
            configurations: [
              {
                language: 'javascript',
                code: "throw new Error('My first Sentry error!');",
              },
              {
                language: 'javascript',
                description: t('Or, try a native crash with:'),
                code: 'Sentry.nativeCrash();',
                additionalInfo: (
                  <Fragment>
                    {t(
                      "If you're new to Sentry, use the email alert to access your account and complete a product tour."
                    )}
                    {t(
                      "If you're an existing user and have disabled alerts, you won't receive this email."
                    )}
                  </Fragment>
                ),
              },
            ],
          },
          ...(params.isPerformanceSelected
            ? [
                {
                  title: t('Tracing'),
                  description: (
                    <Fragment>
                      {t(
                        'Sentry can measure the performance of your app automatically when instrumented with the following routers:'
                      )}
                      <List symbol="bullet">
                        <ListItem>
                          <ExternalLink href="https://docs.sentry.io/platforms/react-native/tracing/instrumentation/react-navigation/">
                            {t('React Navigation')}
                          </ExternalLink>
                        </ListItem>
                        <ListItem>
                          <ExternalLink href="https://docs.sentry.io/platforms/react-native/tracing/instrumentation/react-navigation-v4/">
                            {t('React Navigation V4 and prior')}
                          </ExternalLink>
                        </ListItem>
                        <ListItem>
                          <ExternalLink href="https://docs.sentry.io/platforms/react-native/tracing/instrumentation/react-native-navigation/">
                            {t('React Native Navigation')}
                          </ExternalLink>
                        </ListItem>
                        <ListItem>
                          <ExternalLink href="https://docs.sentry.io/platforms/react-native/tracing/instrumentation/expo-router/">
                            {t('Expo Router')}
                          </ExternalLink>
                        </ListItem>
                      </List>
                      {t(
                        'Additionally, you can create transactions and spans programatically:'
                      )}
                    </Fragment>
                  ),
                  configurations: [
                    {
                      description: t('For example:'),
                      language: 'javascript',
                      code: getPerformanceSnippet(),
                      additionalInfo: tct(
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
              ]
            : []),
          {
            title: t('Debug Symbols'),
            description: (
              <Fragment>
                {t(
                  'We offer a range of methods to provide Sentry with debug symbols so that you can see symbolicated stack traces and triage issues faster.'
                )}
                <p>
                  {tct(
                    "Complete stack traces will be shown for React Native Javascript errors by default using Sentry's [automaticSourceMapsUploadLink:automatic source maps upload]. To set up manual source maps upload follow [guideLink:this guide].",
                    {
                      automaticSourceMapsUploadLink: (
                        <ExternalLink href="https://docs.sentry.io/platforms/react-native/sourcemaps/" />
                      ),
                      guideLink: (
                        <ExternalLink href="https://docs.sentry.io/platforms/react-native/sourcemaps/" />
                      ),
                    }
                  )}
                </p>
                <p>
                  {tct(
                    "You'll also need to upload [debugSymbolsLink:Debug Symbols] generated by the native iOS and Android tooling for native crashes.",
                    {
                      debugSymbolsLink: (
                        <ExternalLink href="https://docs.sentry.io/platforms/react-native/upload-debug/" />
                      ),
                    }
                  )}
                </p>
              </Fragment>
            ),
          },
          {
            title: t('Source Context'),
            description: (
              <Fragment>
                <p>
                  {tct(
                    "If Sentry has access to your application's source code, it can show snippets of code [italic:(source context)] around the location of stack frames, which helps to quickly pinpoint problematic code.",
                    {
                      italic: <i />,
                    }
                  )}
                </p>
                <p>
                  {tct(
                    'Source Context will be shown for React Native Javascript error by default if source maps are uploaded. To set up source maps upload, follow the [sourceMapsGuideLink:Source Maps guide].',
                    {
                      sourceMapsGuideLink: (
                        <ExternalLink href="https://docs.sentry.io/platforms/react-native/sourcemaps/" />
                      ),
                    }
                  )}
                </p>
                <p>
                  {tct(
                    "To enable source context for native errors, you'll need to upload native debug symbols to Sentry by following the instructions at [uploadWithGradleLink:Uploading Source Code Context With Sentry Gradle Plugin] and Uploading Source Context With Xcode.",
                    {
                      uploadWithGradleLink: (
                        <ExternalLink href="https://docs.sentry.io/platforms/react-native/upload-debug/#uploading-source-context-with-sentry-gradle-plugin" />
                      ),
                      uploadWithXCodeLink: (
                        <ExternalLink href="https://docs.sentry.io/platforms/react-native/upload-debug/#uploading-source-context-with-xcode" />
                      ),
                    }
                  )}
                </p>
              </Fragment>
            ),
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
      description: getCrashReportInstallDescription(),
      configurations: [
        {
          code: [
            {
              label: 'TypeScript',
              value: 'typescript',
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
      description: t(
        'Make sure your Sentry React Native SDK version is at least 6.5.0. If you already have the SDK installed, you can update it to the latest version with:'
      ),
      configurations: [
        {
          code: [
            {
              label: 'npm',
              value: 'npm',
              language: 'bash',
              code: `npm install @sentry/react-native --save`,
            },
            {
              label: 'yarn',
              value: 'yarn',
              language: 'bash',
              code: `yarn add @sentry/react-native`,
            },
            {
              label: 'pnpm',
              value: 'pnpm',
              language: 'bash',
              code: `pnpm add @sentry/react-native`,
            },
          ],
        },
        {
          description: t(
            'To set up the integration, add the following to your Sentry initialization:'
          ),
        },
        {
          code: [
            {
              label: 'JavaScript',
              value: 'javascript',
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
      description: getReplayMobileConfigureDescription({
        link: 'https://docs.sentry.io/platforms/react-native/session-replay/#privacy',
      }),
      configurations: [
        {
          description: t(
            'The following code is the default configuration, which masks and blocks everything.'
          ),
          code: [
            {
              label: 'JavaScript',
              value: 'javascript',
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
  feedbackOnboardingCrashApi,
  crashReportOnboarding: feedbackOnboardingCrashApi,
  replayOnboarding,
  platformOptions,
};

export default docs;
