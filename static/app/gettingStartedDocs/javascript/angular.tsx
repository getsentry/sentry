import {buildSdkConfig} from 'sentry/components/onboarding/gettingStartedDoc/buildSdkConfig';
import crashReportCallout from 'sentry/components/onboarding/gettingStartedDoc/feedback/crashReportCallout';
import {widgetCalloutBlock} from 'sentry/components/onboarding/gettingStartedDoc/feedback/widgetCallout';
import {tracePropagationBlock} from 'sentry/components/onboarding/gettingStartedDoc/replay/tracePropagationMessage';
import {
  StepType,
  type BasePlatformOptions,
  type ContentBlock,
  type Docs,
  type DocsParams,
  type OnboardingConfig,
} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {getUploadSourceMapsStep} from 'sentry/components/onboarding/gettingStartedDoc/utils';
import {
  getCrashReportJavaScriptInstallSteps,
  getCrashReportModalConfigDescription,
  getCrashReportModalIntroduction,
  getFeedbackConfigOptions,
  getFeedbackConfigureDescription,
} from 'sentry/components/onboarding/gettingStartedDoc/utils/feedbackOnboarding';
import {
  getReplayConfigOptions,
  getReplayConfigureDescription,
  getReplayVerifyStep,
} from 'sentry/components/onboarding/gettingStartedDoc/utils/replayOnboarding';
import {featureFlagOnboarding} from 'sentry/gettingStartedDocs/javascript/javascript';
import {t, tct} from 'sentry/locale';
import {
  getJavascriptLogsOnboarding,
  getJavascriptProfilingOnboarding,
} from 'sentry/utils/gettingStartedDocs/javascript';

export enum AngularConfigType {
  APP = 'standalone',
  MODULE = 'module',
}

const platformOptions = {
  configType: {
    label: t('Config Type'),
    defaultValue: AngularConfigType.APP,
    items: [
      {
        label: 'App Config',
        value: AngularConfigType.APP,
      },
      {
        label: 'NGModule Config',
        value: AngularConfigType.MODULE,
      },
    ],
  },
} satisfies BasePlatformOptions;

type PlatformOptions = typeof platformOptions;
type Params = DocsParams<PlatformOptions>;

function isModuleConfig(params: Params) {
  return params.platformOptions.configType === AngularConfigType.MODULE;
}

const getIntegrations = (params: Params): string[] => {
  const integrations = [];

  if (params.isPerformanceSelected) {
    integrations.push(`Sentry.browserTracingIntegration()`);
  }

  if (params.isProfilingSelected) {
    integrations.push(`Sentry.browserProfilingIntegration()`);
  }

  if (params.isReplaySelected) {
    integrations.push(
      `Sentry.replayIntegration(${getReplayConfigOptions(params.replayOptions)})`
    );
  }

  if (params.isFeedbackSelected) {
    integrations.push(`
      Sentry.feedbackIntegration({
        colorScheme: "system",
        ${getFeedbackConfigOptions(params.feedbackOptions)}
      }),`);
  }

  return integrations;
};

const getDynamicParts = (params: Params): string[] => {
  const dynamicParts: string[] = [];

  if (params.isPerformanceSelected) {
    dynamicParts.push(`
      // Tracing
      tracesSampleRate: 1.0, //  Capture 100% of the transactions
      // Set 'tracePropagationTargets' to control for which URLs distributed tracing should be enabled
      tracePropagationTargets: ["localhost", /^https:\\/\\/yourserver\\.io\\/api/]`);
  }

  if (params.isReplaySelected) {
    dynamicParts.push(`
      // Session Replay
      replaysSessionSampleRate: 0.1, // This sets the sample rate at 10%. You may want to change it to 100% while in development and then sample at a lower rate in production.
      replaysOnErrorSampleRate: 1.0 // If you're not already sampling the entire session, change the sample rate to 100% when sampling sessions where errors occur.`);
  }

  if (params.isLogsSelected) {
    dynamicParts.push(`
      // Enable sending logs to Sentry
      enableLogs: true`);
  }

  if (params.isProfilingSelected) {
    dynamicParts.push(`
        // Set profilesSampleRate to 1.0 to profile every transaction.
        // Since profilesSampleRate is relative to tracesSampleRate,
        // the final profiling rate can be computed as tracesSampleRate * profilesSampleRate
        // For example, a tracesSampleRate of 0.5 and profilesSampleRate of 0.5 would
        // results in 25% of transactions being profiled (0.5*0.5=0.25)
        profilesSampleRate: 1.0`);
  }

  return dynamicParts;
};

function getSdkSetupSnippet(params: Params) {
  const imports = isModuleConfig(params)
    ? `
import { platformBrowserDynamic } from "@angular/platform-browser-dynamic";
import * as Sentry from "@sentry/angular";

import { AppModule } from "./app/app.module";`
    : `
import { bootstrapApplication } from '@angular/platform-browser';
import * as Sentry from "@sentry/angular";

import { appConfig } from './app/app.config';
import { AppComponent } from './app/app.component';
  `;

  const appInit = isModuleConfig(params)
    ? `
platformBrowserDynamic()
  .bootstrapModule(AppModule)
  .catch((err) => console.error(err));`
    : `
bootstrapApplication(appConfig, AppComponent)
  .catch((err) => console.error(err));`;

  const config = buildSdkConfig({
    params,
    staticParts: [
      `dsn: "${params.dsn.public}"`,
      `// Setting this option to true will send default PII data to Sentry.
      // For example, automatic IP address collection on events
      sendDefaultPii: true`,
    ],
    getIntegrations,
    getDynamicParts,
  });

  return `${imports.trim()}

Sentry.init({
  ${config}
});

  ${appInit.trim()}`;
}

const getConfigureAppModuleSnippet = () => `
import { APP_INITIALIZER, ErrorHandler, NgModule } from "@angular/core";
import { Router } from "@angular/router";
import * as Sentry from "@sentry/angular";

@NgModule({
  // ...
  providers: [
  {
      provide: ErrorHandler,
      useValue: Sentry.createErrorHandler({
        showDialog: true,
      }),
    }, {
      provide: Sentry.TraceService,
      deps: [Router],
    },
    {
      provide: APP_INITIALIZER,
      useFactory: () => () => {},
      deps: [Sentry.TraceService],
      multi: true,
    },
  ],
})
export class AppModule {}
`;

const getConfigureAppConfigSnippet = () => `
import { APP_INITIALIZER, ApplicationConfig, ErrorHandler } from '@angular/core';
import { Router } from '@angular/router';
import * as Sentry from "@sentry/angular";

export const appConfig: ApplicationConfig = {
  providers: [
    // ...
    {
      provide: ErrorHandler,
      useValue: Sentry.createErrorHandler(),
    },
    {
      provide: Sentry.TraceService,
      deps: [Router],
    },
    {
      provide: APP_INITIALIZER,
      useFactory: () => () => {},
      deps: [Sentry.TraceService],
      multi: true,
    },
  ]
};
`;

const getVerifySnippetTemplate = () => `
<button (click)="throwTestError()">Test Sentry Error</button>
`;

const getVerifySnippetComponent = (params: Params) => `${
  params.isLogsSelected ? 'import * as Sentry from "@sentry/angular";\n\n' : ''
}export class AppComponent {
  public throwTestError(): void {${
    params.isLogsSelected
      ? `
    // Send a log before throwing the error
    Sentry.logger.info(Sentry.logger.fmt\`User \${"sentry-test"} triggered test error button\`, {
      action: "test_error_button_click",
    });`
      : ''
  }
    throw new Error("Sentry Test Error");
  }
}`;

const installSnippetBlock: ContentBlock = {
  type: 'code',
  tabs: [
    {
      label: 'npm',
      language: 'bash',
      code: 'npm install --save @sentry/angular',
    },
    {
      label: 'yarn',
      language: 'bash',
      code: 'yarn add @sentry/angular',
    },
    {
      label: 'pnpm',
      language: 'bash',
      code: 'pnpm install @sentry/angular',
    },
  ],
};

const onboarding: OnboardingConfig<PlatformOptions> = {
  introduction: () =>
    tct(
      'In this quick guide you will use [strong:npm], [strong:yarn] or [strong:pnpm] to set up:',
      {
        strong: <strong />,
      }
    ),
  install: () => [
    {
      type: StepType.INSTALL,
      content: [
        {
          type: 'text',
          text: tct(
            'Add the Sentry SDK as a dependency using [code:npm], [code:yarn] or [code:pnpm]:',
            {code: <code />}
          ),
        },
        installSnippetBlock,
      ],
    },
  ],
  configure: (params: Params) => [
    {
      type: StepType.CONFIGURE,
      content: [
        {
          type: 'text',
          text: tct(
            `Initialize the Sentry Angular SDK in your [code:main.ts] file as early as possible, before initializing Angular:`,
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
              code: getSdkSetupSnippet(params),
            },
          ],
        },
        {
          type: 'text',
          text: isModuleConfig(params)
            ? tct(
                "Register the Sentry Angular SDK's ErrorHandler and Tracing providers in your [code:app.module.ts] file:",
                {code: <code />}
              )
            : tct(
                "Register the Sentry Angular SDK's ErrorHandler and Tracing providers in your [code:app.config.ts] file:",
                {code: <code />}
              ),
        },
        {
          type: 'code',
          tabs: [
            {
              label: 'JavaScript',
              language: 'javascript',
              code: isModuleConfig(params)
                ? getConfigureAppModuleSnippet()
                : getConfigureAppConfigSnippet(),
            },
          ],
        },
      ],
    },
    getUploadSourceMapsStep({
      guideLink: 'https://docs.sentry.io/platforms/javascript/guides/angular/sourcemaps/',
      ...params,
    }),
  ],
  verify: (params: Params) => [
    {
      type: StepType.VERIFY,
      content: [
        {
          type: 'text',
          text: params.isLogsSelected
            ? t(
                'To verify that everything is working as expected, you can trigger a test error and a test log in your app. As an example we will add a button that logs to Sentry and then throws an error when being clicked.'
              )
            : t(
                'To verify that everything is working as expected, you can trigger a test error in your app. As an example we will add a button that throws an error when being clicked to your main app component.'
              ),
        },
        {
          type: 'text',
          text: tct('First add the button element to your [code:app.component.html]:', {
            code: <code />,
          }),
        },
        {
          type: 'code',
          tabs: [
            {
              label: 'HTML',
              language: 'html',
              filename: 'app.component.html',
              code: getVerifySnippetTemplate(),
            },
          ],
        },
        {
          type: 'text',
          text: tct('Then, in your [code:app.component.ts] add the event handler:', {
            code: <code />,
          }),
        },
        {
          type: 'code',
          tabs: [
            {
              label: 'TypeScript',
              language: 'typescript',
              filename: 'app.component.ts',
              code: getVerifySnippetComponent(params),
            },
          ],
        },
        {
          type: 'text',
          text: t(
            "After clicking the button, you should see the error on Sentry's Issues page."
          ),
        },
      ],
    },
  ],
  nextSteps: (params: Params) => {
    const steps = [
      {
        id: 'angular-features',
        name: t('Angular Features'),
        description: t(
          'Learn about our first class integration with the Angular framework.'
        ),
        link: 'https://docs.sentry.io/platforms/javascript/guides/angular/features/',
      },
    ];

    if (params.isLogsSelected) {
      steps.push({
        id: 'logs',
        name: t('Logging Integrations'),
        description: t(
          'Add logging integrations to automatically capture logs from your application.'
        ),
        link: 'https://docs.sentry.io/platforms/javascript/guides/angular/logs/#integrations',
      });
    }

    return steps;
  },
};

const replayOnboarding: OnboardingConfig<PlatformOptions> = {
  install: () => [
    {
      type: StepType.INSTALL,
      content: [
        {
          type: 'text',
          text: tct(
            'In order to use Session Replay, you will need version 7.27.0 of [code:@sentry/angular] at minimum. You do not need to install any additional packages.',
            {
              code: <code />,
            }
          ),
        },
        installSnippetBlock,
      ],
    },
  ],
  configure: (params: Params) => [
    {
      type: StepType.CONFIGURE,
      content: [
        {
          type: 'text',
          text: getReplayConfigureDescription({
            link: 'https://docs.sentry.io/platforms/javascript/guides/angular/session-replay/',
          }),
        },
        {
          type: 'code',
          tabs: [
            {
              label: 'JavaScript',
              language: 'javascript',
              code: getSdkSetupSnippet(params),
            },
          ],
        },
        tracePropagationBlock,
      ],
    },
  ],
  verify: getReplayVerifyStep(),
  nextSteps: () => [],
};

const feedbackOnboarding: OnboardingConfig<PlatformOptions> = {
  install: () => [
    {
      type: StepType.INSTALL,
      content: [
        {
          type: 'text',
          text: tct(
            'For the User Feedback integration to work, you must have the Sentry browser SDK package, or an equivalent framework SDK (e.g. [code:@sentry/angular]) installed, minimum version 7.85.0.',
            {
              code: <code />,
            }
          ),
        },
        installSnippetBlock,
      ],
    },
  ],
  configure: (params: Params) => [
    {
      type: StepType.CONFIGURE,
      content: [
        {
          type: 'text',
          text: getFeedbackConfigureDescription({
            linkConfig:
              'https://docs.sentry.io/platforms/javascript/guides/angular/user-feedback/configuration/',
            linkButton:
              'https://docs.sentry.io/platforms/javascript/guides/angular/user-feedback/configuration/#bring-your-own-button',
          }),
        },
        {
          type: 'code',
          tabs: [
            {
              label: 'JavaScript',
              language: 'javascript',
              code: getSdkSetupSnippet(params),
            },
          ],
        },
        {
          type: 'custom',
          content: crashReportCallout({
            link: 'https://docs.sentry.io/platforms/javascript/guides/angular/user-feedback/#crash-report-modal',
          }),
        },
      ],
    },
  ],
  verify: () => [],
  nextSteps: () => [],
};

const crashReportOnboarding: OnboardingConfig<PlatformOptions> = {
  introduction: () => getCrashReportModalIntroduction(),
  install: (params: Params) => getCrashReportJavaScriptInstallSteps(params),
  configure: () => [
    {
      type: StepType.CONFIGURE,
      content: [
        {
          type: 'text',
          text: getCrashReportModalConfigDescription({
            link: 'https://docs.sentry.io/platforms/javascript/guides/angular/user-feedback/configuration/#crash-report-modal',
          }),
        },
        widgetCalloutBlock({
          link: 'https://docs.sentry.io/platforms/javascript/guides/angular/user-feedback/#user-feedback-widget',
        }),
      ],
    },
  ],
  verify: () => [],
  nextSteps: () => [],
};

const profilingOnboarding = getJavascriptProfilingOnboarding({
  installSnippetBlock,
  docsLink:
    'https://docs.sentry.io/platforms/javascript/guides/angular/profiling/browser-profiling/',
});

const logsOnboarding: OnboardingConfig = getJavascriptLogsOnboarding({
  installSnippetBlock,
  docsPlatform: 'angular',
  sdkPackage: '@sentry/angular',
});

const docs: Docs<PlatformOptions> = {
  onboarding,
  feedbackOnboardingNpm: feedbackOnboarding,
  replayOnboarding,
  crashReportOnboarding,
  platformOptions,
  profilingOnboarding,
  featureFlagOnboarding,
  logsOnboarding,
};

export default docs;
