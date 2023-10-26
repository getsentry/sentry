import {Layout, LayoutProps} from 'sentry/components/onboarding/gettingStartedDoc/layout';
import {ModuleProps} from 'sentry/components/onboarding/gettingStartedDoc/sdkDocumentation';
import {StepType} from 'sentry/components/onboarding/gettingStartedDoc/step';
import {PlatformOption} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {getUploadSourceMapsStep} from 'sentry/components/onboarding/gettingStartedDoc/utils';
import {useUrlPlatformOptions} from 'sentry/components/onboarding/platformOptionsControl';
import {ProductSolution} from 'sentry/components/onboarding/productSelection';
import {t, tct} from 'sentry/locale';
import type {Organization, PlatformKey} from 'sentry/types';

export enum SiblingOption {
  ANGULARV10 = 'angularV10',
  ANGULARV12 = 'angularV12',
  REACT = 'react',
  VUE3 = 'vue3',
  VUE2 = 'vue2',
}

type PlaformOptionKey = 'siblinOption';

type StepProps = {
  errorHandlerProviders: string;
  sentryInitContent: string;
  siblingOption: SiblingOption;
  newOrg?: boolean;
  organization?: Organization;
  platformKey?: PlatformKey;
  projectId?: string;
};

const IsAngular = (siblingOption: SiblingOption): boolean =>
  siblingOption === SiblingOption.ANGULARV10 ||
  siblingOption === SiblingOption.ANGULARV12;

const IsVue = (siblingOption: SiblingOption): boolean =>
  siblingOption === SiblingOption.VUE2 || siblingOption === SiblingOption.VUE3;

// Configuration Start
const platformOptions: Record<PlaformOptionKey, PlatformOption> = {
  siblinOption: {
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

const replayIntegration = `
new SiblingSdk.Replay(),
`;

const replayOtherConfig = `
// Session Replay
replaysSessionSampleRate: 0.1, // This sets the sample rate at 10%. You may want to change it to 100% while in development and then sample at a lower rate in production.
replaysOnErrorSampleRate: 1.0, // If you're not already sampling the entire session, change the sample rate to 100% when sampling sessions where errors occur.
`;

const routingInstrumentationConfig = (siblingOption: SiblingOption): string =>
  IsVue(siblingOption)
    ? 'routingInstrumentation: SiblingSdk.VUERouterInstrumentation(router),\n'
    : IsAngular(siblingOption)
    ? 'routingInstrumentation: SiblingSdk.routingInstrumentation,\n'
    : '';

function performanceIntegration(siblingOption: SiblingOption): string {
  let integration = `
new SiblingSdk.BrowserTracing({
  // Set 'tracePropagationTargets' to control for which URLs distributed tracing should be enabled
  tracePropagationTargets: ["localhost", /^https:\\/\\/yourserver\\.io\\/api/],`;
  integration += routingInstrumentationConfig(siblingOption);
  integration += `});`;
  return integration;
}

const performanceOtherConfig = `
// Performance Monitoring
tracesSampleRate: 1.0, // Capture 100% of the transactions`;

const performanceErrorHandler = `
{
  provide: SiblingSdk.TraceService,
  deps: [Router],
},
{
  provide: APP_INITIALIZER,
  useFactory: () => () => {},
  deps: [SiblingSdk.TraceService],
  multi: true,
},
`;

export const steps = ({
  sentryInitContent,
  siblingOption,
  errorHandlerProviders,
  ...props
}: StepProps): LayoutProps['steps'] => [
  {
    type: StepType.INSTALL,
    description: (
      <p>
        {tct(
          `Install the Sentry Capacitor SDK as a dependency using [codeNpm:npm] or [codeYarn:yarn], alongside the Sentry [siblingName:] SDK:`,
          {
            codeYarn: <code />,
            codeNpm: <code />,
            siblingName: getSiblingName(siblingOption),
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
            code: `npm install --save @sentry/capacitor ${getNpmPackage(siblingOption)}`,
          },
          {
            label: 'yarn',
            value: 'yarn',
            language: 'bash',
            code: `yarn add @sentry/capacitor ${getNpmPackage(siblingOption)} --exact`,
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
                siblingName: getSiblingName(siblingOption),
              }
            )}
          </p>
        ),
      },
    ],
  },
  {
    type: StepType.CONFIGURE,
    configurations: getSetupConfiguration(
      siblingOption,
      sentryInitContent,
      errorHandlerProviders
    ),
  },
  getUploadSourceMapsStep({
    guideLink: 'https://docs.sentry.io/platforms/javascript/guides/capacitor/sourcemaps/',
    ...props,
  }),
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
];

function getSiblingImportsSetupConfiguration(siblingOption: SiblingOption): string {
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

function getVueConstSetup(siblingOption: SiblingOption): string {
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

function getSetupConfiguration(
  siblingOption: SiblingOption,
  sentryInitContent: string,
  errorHandlerProviders: string
) {
  const configuration = [
    {
      description: tct(
        `You should init the Sentry capacitor SDK in your main.ts file as soon as possible during application load up, before initializing Sentry [siblingName:]:`,
        {
          siblingName: getSiblingName(siblingOption),
        }
      ),
      language: 'javascript',
      code: `${getSiblingImportsSetupConfiguration(siblingOption)}
          import * as Sentry from '@sentry/capacitor';
          import * as SiblingSdk from '${getNpmPackage(siblingOption)}';
          ${getVueConstSetup(siblingOption)}
          Sentry.init({
            ${sentryInitContent}
});`,
    },
  ];
  if (IsAngular(siblingOption)) {
    configuration.push({
      description: tct(
        "The Sentry Angular SDK exports a function to instantiate ErrorHandler provider that will automatically send JavaScript errors captured by the Angular's error handler.",
        {}
      ),
      language: 'javascript',
      code: `
import { APP_INITIALIZER, ErrorHandler, NgModule } from "@angular/core";
import { Router } from "@angular/router";
import * as SiblingSdk from "${getNpmPackage(siblingOption)}";

@NgModule({
// ...
providers: [
{
  provide: ErrorHandler,
  useValue: SiblingSdk.createErrorHandler(),
},
${errorHandlerProviders}
],
// ...
})
export class AppModule {}`,
    });
  }
  return configuration;
}

function getNpmPackage(siblinOption: SiblingOption): string {
  const packages: Record<SiblingOption, string> = {
    [SiblingOption.ANGULARV10]: '@sentry/angular',
    [SiblingOption.ANGULARV12]: '@sentry/angular-ivy',
    [SiblingOption.REACT]: '@sentry/react',
    [SiblingOption.VUE3]: '@sentry/vue',
    [SiblingOption.VUE2]: '@sentry/vue',
  };
  return packages[siblinOption];
}

function getSiblingName(siblinOption: SiblingOption): string {
  switch (siblinOption) {
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
// Configuration End

export function GettingStartedWithCapacitor({
  dsn,
  activeProductSelection = [],
  organization,
  newOrg,
  platformKey,
  projectId,
  ...props
}: ModuleProps) {
  const optionValues = useUrlPlatformOptions(platformOptions);
  const siblingOption = optionValues.siblinOption as SiblingOption;

  const integrations: string[] = [];
  const otherConfigs: string[] = [];

  let nextStepDocs = [...nextSteps];
  const errorHandlerProviders: string[] = [];

  if (activeProductSelection.includes(ProductSolution.PERFORMANCE_MONITORING)) {
    integrations.push(performanceIntegration(siblingOption).trim());
    otherConfigs.push(performanceOtherConfig.trim());
    errorHandlerProviders.push(performanceErrorHandler.trim());
    nextStepDocs = nextStepDocs.filter(
      step => step.id !== ProductSolution.PERFORMANCE_MONITORING
    );
  }

  if (activeProductSelection.includes(ProductSolution.SESSION_REPLAY)) {
    integrations.push(replayIntegration.trim());
    otherConfigs.push(replayOtherConfig.trim());
    nextStepDocs = nextStepDocs.filter(
      step => step.id !== ProductSolution.SESSION_REPLAY
    );
  }

  let sentryInitContent: string[] = [];
  if (siblingOption === SiblingOption.VUE3) {
    sentryInitContent.push(`app,`);
  } else if (siblingOption === SiblingOption.VUE2) {
    sentryInitContent.push(`Vue,`);
  }

  sentryInitContent.push(`dsn: "${dsn}",`);
  if (integrations.length > 0) {
    sentryInitContent = sentryInitContent.concat('integrations: [', integrations, '],');
  }

  if (otherConfigs.length > 0) {
    sentryInitContent = sentryInitContent.concat(otherConfigs);
  }

  sentryInitContent.push(
    `// Forward the init method from ${getNpmPackage(siblingOption)}`
  );
  sentryInitContent.push(`SiblingSdk.init`);

  return (
    <Layout
      steps={steps({
        sentryInitContent: sentryInitContent.join('\n'),
        errorHandlerProviders: errorHandlerProviders.join('\n'),
        siblingOption,
        organization,
        newOrg,
        platformKey,
        projectId,
      })}
      nextSteps={nextStepDocs}
      platformOptions={platformOptions}
      newOrg={newOrg}
      platformKey={platformKey}
      {...props}
    />
  );
}

export default GettingStartedWithCapacitor;
