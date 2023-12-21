import {StepType} from 'sentry/components/onboarding/gettingStartedDoc/step';
import type {
  Docs,
  DocsParams,
  OnboardingConfig,
  PlatformOption,
} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {
  getReplayConfigOptions,
  getReplayConfigureDescription,
  getUploadSourceMapsStep,
} from 'sentry/components/onboarding/gettingStartedDoc/utils';
import {getJSMetricsOnboarding} from 'sentry/components/onboarding/gettingStartedDoc/utils/metricsOnboarding';
import {ProductSolution} from 'sentry/components/onboarding/productSelection';
import {t, tct} from 'sentry/locale';

export enum AngularVersion {
  V10 = 'v10',
  V12 = 'v12',
}

type PlaformOptionKey = 'siblingOption';

const platformOptions: Record<PlaformOptionKey, PlatformOption> = {
  siblingOption: {
    label: t('Angular Version'),
    items: [
      {
        label: t('Angular 12+'),
        value: AngularVersion.V12,
      },
      {
        label: t('Angular 10 and 11'),
        value: AngularVersion.V10,
      },
    ],
  },
};

type PlatformOptions = typeof platformOptions;
type Params = DocsParams<PlatformOptions>;

const getNextStep = (
  params: Params
): {
  description: string;
  id: string;
  link: string;
  name: string;
}[] => {
  let nextStepDocs = [...nextSteps];

  if (params.isPerformanceSelected) {
    nextStepDocs = nextStepDocs.filter(
      step => step.id !== ProductSolution.PERFORMANCE_MONITORING
    );
  }

  if (params.isReplaySelected) {
    nextStepDocs = nextStepDocs.filter(
      step => step.id !== ProductSolution.SESSION_REPLAY
    );
  }
  return nextStepDocs;
};

function getNpmPackage(angularVersion) {
  return angularVersion === AngularVersion.V12
    ? '@sentry/angular-ivy'
    : '@sentry/angular';
}

const getInstallConfig = (params: Params) => [
  {
    language: 'bash',
    code: [
      {
        label: 'npm',
        value: 'npm',
        language: 'bash',
        code: `npm install --save ${getNpmPackage(params.platformOptions.siblingOption)}`,
      },
      {
        label: 'yarn',
        value: 'yarn',
        language: 'bash',
        code: `yarn add ${getNpmPackage(params.platformOptions.siblingOption)}`,
      },
    ],
  },
];

const onboarding: OnboardingConfig<PlatformOptions> = {
  install: (params: Params) => [
    {
      type: StepType.INSTALL,
      description: tct(
        'Add the Sentry SDK as a dependency using [codeNpm:npm] or [codeYarn:yarn]:',
        {
          codeYarn: <code />,
          codeNpm: <code />,
        }
      ),
      configurations: getInstallConfig(params),
    },
  ],
  configure: params => [
    {
      type: StepType.CONFIGURE,
      configurations: [
        getSetupConfiguration(params),
        {
          description: t(
            "The Sentry Angular SDK exports a function to instantiate ErrorHandler provider that will automatically send JavaScript errors captured by the Angular's error handler."
          ),
          language: 'javascript',
          code: `
    import { APP_INITIALIZER, ErrorHandler, NgModule } from "@angular/core";
    import { Router } from "@angular/router";
    import * as Sentry from "${getNpmPackage(params.platformOptions.siblingOption)}";

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
    // ...
    })
    export class AppModule {}`,
        },
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
      description: t(
        "This snippet contains an intentional error and can be used as a test to make sure that everything's working as expected."
      ),
      configurations: [
        {
          language: 'javascript',
          code: `myUndefinedFunction();`,
        },
      ],
    },
  ],
  nextSteps: params => getNextStep(params),
};

export const nextSteps = [
  {
    id: 'angular-features',
    name: t('Angular Features'),
    description: t('Learn about our first class integration with the Angular framework.'),
    link: 'https://docs.sentry.io/platforms/javascript/guides/angular/features/',
  },
  {
    id: 'performance-monitoring',
    name: t('Performance Monitoring'),
    description: t(
      'Track down transactions to connect the dots between 10-second page loads and poor-performing API calls or slow database queries.'
    ),
    link: 'https://docs.sentry.io/platforms/javascript/guides/angular/performance/',
  },
  {
    id: 'session-replay',
    name: t('Session Replay'),
    description: t(
      'Get to the root cause of an error or latency issue faster by seeing all the technical details related to that issue in one visual replay on your web application.'
    ),
    link: 'https://docs.sentry.io/platforms/javascript/guides/angular/session-replay/',
  },
];

function getSdkSetupSnippet(params: Params) {
  const siblingOption = params.platformOptions.siblingOption;
  return `
  import { enableProdMode } from "@angular/core";
  import { platformBrowserDynamic } from "@angular/platform-browser-dynamic";
  import * as Sentry from "${getNpmPackage(siblingOption)}";

  import { AppModule } from "./app/app.module";

  Sentry.init({
    dsn: "${params.dsn}",
    integrations: [${
      params.isPerformanceSelected
        ? `
          new Sentry.BrowserTracing({
            // Set 'tracePropagationTargets' to control for which URLs distributed tracing should be enabled
            tracePropagationTargets: ["localhost", /^https:\\/\\/yourserver\\.io\\/api/],
          }),`
        : ''
    }${
      params.isReplaySelected
        ? `
          new Sentry.Replay(${getReplayConfigOptions(params.replayOptions)}),`
        : ''
    }
  ],${
    params.isPerformanceSelected
      ? `
        // Performance Monitoring
        tracesSampleRate: 1.0, //  Capture 100% of the transactions`
      : ''
  }${
    params.isReplaySelected
      ? `
        // Session Replay
        replaysSessionSampleRate: 0.1, // This sets the sample rate at 10%. You may want to change it to 100% while in development and then sample at a lower rate in production.
        replaysOnErrorSampleRate: 1.0, // If you're not already sampling the entire session, change the sample rate to 100% when sampling sessions where errors occur.`
      : ''
  }
  });`;
}

function getSetupConfiguration(params: Params) {
  const configuration = {
    description: tct(
      `You should init the Sentry browser SDK in your [code:main.ts] file as soon as possible during application load up, before initializing Angular:`,
      {
        code: <code />,
      }
    ),
    language: 'javascript',
    code: `
    ${getSdkSetupSnippet(params)}

      enableProdMode();
      platformBrowserDynamic()
      .bootstrapModule(AppModule)
      .then((success) => console.log('Bootstrap success'))
      .catch((err) => console.error(err));`,
  };
  return configuration;
}

const replayOnboarding: OnboardingConfig<PlatformOptions> = {
  install: (params: Params) => [
    {
      type: StepType.INSTALL,
      description: tct(
        'In order to use Session Replay, you will need version 7.27.0 of [codeAngular:@sentry/angular] or [codeIvy:@sentry/angular-ivy] at minimum. You do not need to install any additional packages.',
        {
          codeAngular: <code />,
          codeIvy: <code />,
        }
      ),
      configurations: getInstallConfig(params),
    },
  ],
  configure: params => [
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
    },
  ],
  verify: () => [],
  nextSteps: () => [],
};

const docs: Docs<PlatformOptions> = {
  onboarding,
  platformOptions,
  replayOnboardingNpm: replayOnboarding,
  customMetricsOnboarding: getJSMetricsOnboarding({getInstallConfig}),
};

export default docs;
