import {Fragment} from 'react';

import crashReportCallout from 'sentry/components/onboarding/gettingStartedDoc/feedback/crashReportCallout';
import widgetCallout from 'sentry/components/onboarding/gettingStartedDoc/feedback/widgetCallout';
import TracePropagationMessage from 'sentry/components/onboarding/gettingStartedDoc/replay/tracePropagationMessage';
import {
  type Configuration,
  StepType,
} from 'sentry/components/onboarding/gettingStartedDoc/step';
import type {
  BasePlatformOptions,
  Docs,
  DocsParams,
  OnboardingConfig,
} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {getUploadSourceMapsStep} from 'sentry/components/onboarding/gettingStartedDoc/utils';
import {
  getCrashReportJavaScriptInstallStep,
  getCrashReportModalConfigDescription,
  getCrashReportModalIntroduction,
  getFeedbackConfigOptions,
  getFeedbackConfigureDescription,
} from 'sentry/components/onboarding/gettingStartedDoc/utils/feedbackOnboarding';
import {
  getProfilingDocumentHeaderConfigurationStep,
  MaybeBrowserProfilingBetaWarning,
} from 'sentry/components/onboarding/gettingStartedDoc/utils/profilingOnboarding';
import {
  getReplayConfigOptions,
  getReplayConfigureDescription,
  getReplayVerifyStep,
} from 'sentry/components/onboarding/gettingStartedDoc/utils/replayOnboarding';
import {featureFlagOnboarding} from 'sentry/gettingStartedDocs/javascript/javascript';
import {t, tct} from 'sentry/locale';

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

  return `${imports.trim()}

Sentry.init({
  dsn: "${params.dsn.public}",
  integrations: [${
    params.isPerformanceSelected
      ? `
    Sentry.browserTracingIntegration(),`
      : ''
  }${
    params.isProfilingSelected
      ? `
    Sentry.browserProfilingIntegration(),`
      : ''
  }${
    params.isFeedbackSelected
      ? `
    Sentry.feedbackIntegration({
      // Additional SDK configuration goes in here, for example:
      colorScheme: "system",
    ${getFeedbackConfigOptions(params.feedbackOptions)}}),`
      : ''
  }${
    params.isReplaySelected
      ? `
    Sentry.replayIntegration(${getReplayConfigOptions(params.replayOptions)}),`
      : ''
  }
  ],${
    params.isPerformanceSelected
      ? `
  // Tracing
  tracesSampleRate: 1.0, //  Capture 100% of the transactions
  // Set 'tracePropagationTargets' to control for which URLs distributed tracing should be enabled
  tracePropagationTargets: ["localhost", /^https:\\/\\/yourserver\\.io\\/api/],`
      : ''
  }${
    params.isReplaySelected
      ? `
  // Session Replay
  replaysSessionSampleRate: 0.1, // This sets the sample rate at 10%. You may want to change it to 100% while in development and then sample at a lower rate in production.
  replaysOnErrorSampleRate: 1.0, // If you're not already sampling the entire session, change the sample rate to 100% when sampling sessions where errors occur.`
      : ''
  }${
    params.isProfilingSelected
      ? `
  // Set profilesSampleRate to 1.0 to profile every transaction.
  // Since profilesSampleRate is relative to tracesSampleRate,
  // the final profiling rate can be computed as tracesSampleRate * profilesSampleRate
  // For example, a tracesSampleRate of 0.5 and profilesSampleRate of 0.5 would
  // results in 25% of transactions being profiled (0.5*0.5=0.25)
  profilesSampleRate: 1.0,`
      : ''
  }
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

const getVerifySnippetComponent = () => `
public throwTestError(): void {
  throw new Error("Sentry Test Error");
}`;

function getVerifyConfiguration(): Configuration {
  return {
    description: t(
      'To verify that everything is working as expected, you can trigger a test error in your app. As an example we will add a button that throws an error when being clicked to your main app component.'
    ),
    configurations: [
      {
        description: tct(
          'First add the button element to your [code:app.component.html]:',
          {code: <code />}
        ),
        code: [
          {
            label: 'HTML',
            value: 'html',
            language: 'html',
            filename: 'app.component.html',
            code: getVerifySnippetTemplate(),
          },
        ],
      },
      {
        description: tct('Then, in your [code:app.component.ts] add the event handler:', {
          code: <code />,
        }),
        code: [
          {
            label: 'TypeScript',
            value: 'typescript',
            language: 'typescript',
            filename: 'app.component.ts',
            code: getVerifySnippetComponent(),
          },
        ],
      },
    ],
  };
}

const getInstallConfig = () => [
  {
    language: 'bash',
    code: [
      {
        label: 'npm',
        value: 'npm',
        language: 'bash',
        code: `npm install --save @sentry/angular`,
      },
      {
        label: 'yarn',
        value: 'yarn',
        language: 'bash',
        code: `yarn add @sentry/angular`,
      },
      {
        label: 'pnpm',
        value: 'pnpm',
        language: 'bash',
        code: `pnpm install @sentry/angular`,
      },
    ],
  },
];

const onboarding: OnboardingConfig<PlatformOptions> = {
  introduction: params => (
    <Fragment>
      <MaybeBrowserProfilingBetaWarning {...params} />
      <p>
        {tct(
          'In this quick guide you’ll use [strong:npm], [strong:yarn] or [strong:pnpm] to set up:',
          {
            strong: <strong />,
          }
        )}
      </p>
    </Fragment>
  ),
  install: () => [
    {
      type: StepType.INSTALL,
      description: tct(
        'Add the Sentry SDK as a dependency using [code:npm], [code:yarn] or [code:pnpm]:',
        {code: <code />}
      ),
      configurations: getInstallConfig(),
    },
  ],
  configure: (params: Params) => [
    {
      type: StepType.CONFIGURE,
      configurations: [
        {
          description: tct(
            `Initialize the Sentry Angular SDK in your [code:main.ts] file as early as possible, before initializing Angular:`,
            {
              code: <code />,
            }
          ),
          language: 'javascript',
          code: getSdkSetupSnippet(params),
        },
        {
          description: isModuleConfig(params)
            ? tct(
                "Register the Sentry Angular SDK's ErrorHandler and Tracing providers in your [code:app.module.ts] file:",
                {code: <code />}
              )
            : tct(
                "Register the Sentry Angular SDK's ErrorHandler and Tracing providers in your [code:app.config.ts] file:",
                {code: <code />}
              ),
          language: 'javascript',
          code: isModuleConfig(params)
            ? getConfigureAppModuleSnippet()
            : getConfigureAppConfigSnippet(),
        },
        ...(params.isProfilingSelected
          ? [getProfilingDocumentHeaderConfigurationStep()]
          : []),
      ],
    },
    getUploadSourceMapsStep({
      guideLink: 'https://docs.sentry.io/platforms/javascript/guides/angular/sourcemaps/',
      ...params,
    }),
  ],
  verify: () => [
    {
      type: StepType.VERIFY,
      configurations: [
        getVerifyConfiguration(),
        {
          description: t(
            "After clicking the button, you should see the error on Sentry's Issues page."
          ),
        },
      ],
    },
  ],
  nextSteps: () => [
    {
      id: 'angular-features',
      name: t('Angular Features'),
      description: t(
        'Learn about our first class integration with the Angular framework.'
      ),
      link: 'https://docs.sentry.io/platforms/javascript/guides/angular/features/',
    },
  ],
};

const replayOnboarding: OnboardingConfig<PlatformOptions> = {
  install: () => [
    {
      type: StepType.INSTALL,
      description: tct(
        'In order to use Session Replay, you will need version 7.27.0 of [code:@sentry/angular] at minimum. You do not need to install any additional packages.',
        {
          code: <code />,
        }
      ),
      configurations: getInstallConfig(),
    },
  ],
  configure: (params: Params) => [
    {
      type: StepType.CONFIGURE,
      description: getReplayConfigureDescription({
        link: 'https://docs.sentry.io/platforms/javascript/guides/angular/session-replay/',
      }),
      configurations: [
        {
          code: [
            {
              label: 'JavaScript',
              value: 'javascript',
              language: 'javascript',
              code: getSdkSetupSnippet(params),
            },
          ],
        },
      ],
      additionalInfo: <TracePropagationMessage />,
    },
  ],
  verify: getReplayVerifyStep(),
  nextSteps: () => [],
};

const feedbackOnboarding: OnboardingConfig<PlatformOptions> = {
  install: () => [
    {
      type: StepType.INSTALL,
      description: tct(
        'For the User Feedback integration to work, you must have the Sentry browser SDK package, or an equivalent framework SDK (e.g. [code:@sentry/angular]) installed, minimum version 7.85.0.',
        {
          code: <code />,
        }
      ),
      configurations: getInstallConfig(),
    },
  ],
  configure: (params: Params) => [
    {
      type: StepType.CONFIGURE,
      description: getFeedbackConfigureDescription({
        linkConfig:
          'https://docs.sentry.io/platforms/javascript/guides/angular/user-feedback/configuration/',
        linkButton:
          'https://docs.sentry.io/platforms/javascript/guides/angular/user-feedback/configuration/#bring-your-own-button',
      }),
      configurations: [
        {
          code: [
            {
              label: 'JavaScript',
              value: 'javascript',
              language: 'javascript',
              code: getSdkSetupSnippet(params),
            },
          ],
        },
      ],
      additionalInfo: crashReportCallout({
        link: 'https://docs.sentry.io/platforms/javascript/guides/angular/user-feedback/#crash-report-modal',
      }),
    },
  ],
  verify: () => [],
  nextSteps: () => [],
};

const crashReportOnboarding: OnboardingConfig<PlatformOptions> = {
  introduction: () => getCrashReportModalIntroduction(),
  install: (params: Params) => getCrashReportJavaScriptInstallStep(params),
  configure: () => [
    {
      type: StepType.CONFIGURE,
      description: getCrashReportModalConfigDescription({
        link: 'https://docs.sentry.io/platforms/javascript/guides/angular/user-feedback/configuration/#crash-report-modal',
      }),
      additionalInfo: widgetCallout({
        link: 'https://docs.sentry.io/platforms/javascript/guides/angular/user-feedback/#user-feedback-widget',
      }),
    },
  ],
  verify: () => [],
  nextSteps: () => [],
};

const profilingOnboarding: OnboardingConfig<PlatformOptions> = {
  ...onboarding,
  introduction: params => <MaybeBrowserProfilingBetaWarning {...params} />,
};

const docs: Docs<PlatformOptions> = {
  onboarding,
  feedbackOnboardingNpm: feedbackOnboarding,
  replayOnboarding,
  crashReportOnboarding,
  platformOptions,
  profilingOnboarding,
  featureFlagOnboarding,
};

export default docs;
