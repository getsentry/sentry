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
import {ProductSolution} from 'sentry/components/onboarding/productSelection';
import {t, tct} from 'sentry/locale';

export enum SiblingOption {
  ANGULARV10 = 'angularV10',
  ANGULARV12 = 'angularV12',
  REACT = 'react',
  VUE3 = 'vue3',
  VUE2 = 'vue2',
}

type PlaformOptionKey = 'siblingOption';

const platformOptions: Record<PlaformOptionKey, PlatformOption> = {
  siblingOption: {
    label: t('Sibling Package'),
    items: [
      {
        label: t('Angular 12+'),
        value: SiblingOption.ANGULARV12,
      },
      {
        label: t('Angular 10 and 11'),
        value: SiblingOption.ANGULARV10,
      },
      {
        label: t('React'),
        value: SiblingOption.REACT,
      },
      {
        label: t('Vue 3'),
        value: SiblingOption.VUE3,
      },
      {
        label: t('Vue 2'),
        value: SiblingOption.VUE2,
      },
    ],
  },
};

type PlatformOptions = typeof platformOptions;
type Params = DocsParams<PlatformOptions>;

const getSentryInitLayout = (params: Params, siblingOption: string): string => {
  return `${
    siblingOption === SiblingOption.VUE2
      ? `Vue,`
      : siblingOption === SiblingOption.VUE3
      ? 'app,'
      : ''
  }dsn: "${params.dsn}",
  integrations: [${
    params.isPerformanceSelected
      ? `
          new ${getSiblingImportName(siblingOption)}.BrowserTracing({
            // Set 'tracePropagationTargets' to control for which URLs distributed tracing should be enabled
            tracePropagationTargets: ["localhost", /^https:\\/\\/yourserver\\.io\\/api/],
          ${
            params.isPerformanceSelected ? getPerformanceIntegration(siblingOption) : ''
          }})`
      : ''
  }${
    params.isReplaySelected
      ? `
          new ${getSiblingImportName(siblingOption)}.Replay(${getReplayConfigOptions(
            params.replayOptions
          )}),`
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
  }`;
};

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

const isAngular = (siblingOption: string): boolean =>
  siblingOption === SiblingOption.ANGULARV10 ||
  siblingOption === SiblingOption.ANGULARV12;

const isVue = (siblingOption: string): boolean =>
  siblingOption === SiblingOption.VUE2 || siblingOption === SiblingOption.VUE3;

function getPerformanceIntegration(siblingOption: string): string {
  return `${
    isVue(siblingOption)
      ? `routingInstrumentation: SentryVue.vueRouterInstrumentation(router),`
      : isAngular(siblingOption)
      ? `routingInstrumentation: SentryAngular.routingInstrumentation,`
      : ''
  }`;
}

const performanceAngularErrorHandler = `,
{
  provide: SentryAngular.TraceService,
  deps: [Router],
},
{
  provide: APP_INITIALIZER,
  useFactory: () => () => {},
  deps: [SentryAngular.TraceService],
  multi: true,
},`;

const getInstallStep = (params: Params) => [
  {
    type: StepType.INSTALL,
    description: (
      <p>
        {tct(
          `Install the Sentry Capacitor SDK as a dependency using [codeNpm:npm] or [codeYarn:yarn], alongside the Sentry [siblingName:] SDK:`,
          {
            codeYarn: <code />,
            codeNpm: <code />,
            siblingName: getSiblingName(params.platformOptions.siblingOption),
          }
        )}
      </p>
    ),
    configurations: [
      {
        language: 'bash',
        code: [
          {
            label: 'npm',
            value: 'npm',
            language: 'bash',
            code: `npm install --save @sentry/capacitor ${getNpmPackage(
              params.platformOptions.siblingOption
            )}`,
          },
          {
            label: 'yarn',
            value: 'yarn',
            language: 'bash',
            code: `yarn add @sentry/capacitor ${getNpmPackage(
              params.platformOptions.siblingOption
            )} --exact`,
          },
        ],
      },
      {
        additionalInfo: (
          <p>
            {tct(
              `The version of the Sentry [siblingName:] SDK must match with the version referred by Sentry Capacitor. To check which version of the Sentry [siblingName:] SDK is installed, use the following command: [code:npm info @sentry/capacitor peerDependencies]`,
              {
                code: <code />,
                siblingName: getSiblingName(params.platformOptions.siblingOption),
              }
            )}
          </p>
        ),
      },
    ],
  },
];

const onboarding: OnboardingConfig<PlatformOptions> = {
  install: params => getInstallStep(params),
  configure: params => [
    {
      type: StepType.CONFIGURE,
      configurations: getSetupConfiguration({params, showExtraStep: true}),
    },
    getUploadSourceMapsStep({
      guideLink:
        'https://docs.sentry.io/platforms/javascript/guides/capacitor/sourcemaps/',
      ...params,
    }),
  ],
  verify: _ => [
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
    id: 'capacitor-android-setup',
    name: t('Capacitor 2 Setup'),
    description: t(
      'If you are using Capacitor 2 or older, follow this step to add required changes in order to initialize the Capacitor SDK on Android.'
    ),
    link: 'https://docs.sentry.io/platforms/javascript/guides/capacitor/?#capacitor-2---android-specifics',
  },
  {
    id: 'performance-monitoring',
    name: t('Performance Monitoring'),
    description: t(
      'Track down transactions to connect the dots between 10-second page loads and poor-performing API calls or slow database queries.'
    ),
    link: 'https://docs.sentry.io/platforms/javascript/guides/capacitor/performance/',
  },
  {
    id: 'session-replay',
    name: t('Session Replay'),
    description: t(
      'Get to the root cause of an error or latency issue faster by seeing all the technical details related to that issue in one visual replay on your web application.'
    ),
    link: 'https://docs.sentry.io/platforms/javascript/guides/capacitor/session-replay/',
  },
];

function getSiblingImportsSetupConfiguration(siblingOption: string): string {
  switch (siblingOption) {
    case SiblingOption.VUE3:
      return `import {createApp} from "vue";
          import {createRouter} from "vue-router";`;
    case SiblingOption.VUE2:
      return `import Vue from "vue";
          import Router from "vue-router";`;
    default:
      return '';
  }
}

function getVueConstSetup(siblingOption: string): string {
  switch (siblingOption) {
    case SiblingOption.VUE3:
      return `
          const app = createApp({
            // ...
          });
          const router = createRouter({
            // ...
          });
          `;
    case SiblingOption.VUE2:
      return `
          Vue.use(Router);

          const router = new Router({
            // ...
          });
          `;
    default:
      return '';
  }
}

function getSetupConfiguration({
  params,
  showExtraStep,
  showDescription,
}: {
  params: Params;
  showExtraStep: boolean;
  showDescription?: boolean;
}) {
  const siblingOption = params.platformOptions.siblingOption;
  const sentryInitLayout = getSentryInitLayout(params, siblingOption);

  const configuration = [
    {
      description: showDescription
        ? tct(
            `You should init the Sentry capacitor SDK in your [code:main.ts] file as soon as possible during application load up, before initializing Sentry [siblingName:]:`,
            {
              siblingName: getSiblingName(siblingOption),
              code: <code />,
            }
          )
        : null,
      language: 'javascript',
      code: `${getSiblingImportsSetupConfiguration(siblingOption)}
          import * as Sentry from '@sentry/capacitor';
          import * as ${getSiblingImportName(siblingOption)} from '${getNpmPackage(
            siblingOption
          )}';
          ${getVueConstSetup(siblingOption)}
          Sentry.init({
            ${sentryInitLayout}
},
// Forward the init method from ${getNpmPackage(params.platformOptions.siblingOption)}
${getSiblingImportName(siblingOption)}.init
);`,
    },
  ];
  if (isAngular(siblingOption) && showExtraStep) {
    configuration.push({
      description: tct(
        "The Sentry Angular SDK exports a function to instantiate ErrorHandler provider that will automatically send JavaScript errors captured by the Angular's error handler.",
        {}
      ),
      language: 'javascript',
      code: `
import { APP_INITIALIZER, ErrorHandler, NgModule } from "@angular/core";
import { Router } from "@angular/router";
import * as SentryAngular from "${getNpmPackage(siblingOption)}";

@NgModule({
// ...
providers: [
{
  provide: ErrorHandler,
  useValue: SentryAngular.createErrorHandler(),
}${params.isPerformanceSelected ? performanceAngularErrorHandler : ' '}
],
// ...
})
export class AppModule {}`,
    });
  }
  return configuration;
}

function getNpmPackage(siblingOption: string): string {
  const packages: Record<SiblingOption, string> = {
    [SiblingOption.ANGULARV10]: '@sentry/angular',
    [SiblingOption.ANGULARV12]: '@sentry/angular-ivy',
    [SiblingOption.REACT]: '@sentry/react',
    [SiblingOption.VUE3]: '@sentry/vue',
    [SiblingOption.VUE2]: '@sentry/vue',
  };
  return packages[siblingOption];
}

function getSiblingName(siblingOption: string): string {
  siblingOption;
  switch (siblingOption) {
    case SiblingOption.ANGULARV10:
    case SiblingOption.ANGULARV12:
      return 'Angular';
    case SiblingOption.REACT:
      return 'React';
    case SiblingOption.VUE2:
    case SiblingOption.VUE3:
      return 'Vue';
    default:
      return '';
  }
}

function getSiblingImportName(siblingOption: string): string {
  siblingOption;
  switch (siblingOption) {
    case SiblingOption.ANGULARV10:
    case SiblingOption.ANGULARV12:
      return 'SentryAngular';
    case SiblingOption.REACT:
      return 'SentryReact';
    case SiblingOption.VUE2:
    case SiblingOption.VUE3:
      return 'SentryVue';
    default:
      return '';
  }
}

const replayOnboarding: OnboardingConfig<PlatformOptions> = {
  install: params => getInstallStep(params),
  configure: params => [
    {
      type: StepType.CONFIGURE,
      description: getReplayConfigureDescription({
        link: 'https://docs.sentry.io/platforms/javascript/guides/capacitor/session-replay/',
      }),
      configurations: getSetupConfiguration({
        params,
        showExtraStep: false,
        showDescription: false,
      }),
    },
  ],
  verify: () => [],
  nextSteps: () => [],
};

const docs: Docs<PlatformOptions> = {
  onboarding,
  platformOptions,
  replayOnboardingNpm: replayOnboarding,
};

export default docs;
