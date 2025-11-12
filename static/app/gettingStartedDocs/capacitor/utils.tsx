import {buildSdkConfig} from 'sentry/components/onboarding/gettingStartedDoc/buildSdkConfig';
import type {
  ContentBlock,
  DocsParams,
  PlatformOption,
} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {getFeedbackConfigOptions} from 'sentry/components/onboarding/gettingStartedDoc/utils/feedbackOnboarding';
import {getReplayConfigOptions} from 'sentry/components/onboarding/gettingStartedDoc/utils/replayOnboarding';
import {t, tct} from 'sentry/locale';

export enum SiblingOption {
  ANGULARV10 = 'angularV10',
  ANGULARV12 = 'angularV12',
  REACT = 'react',
  VUE3 = 'vue3',
  VUE2 = 'vue2',
}

export const platformOptions: PlatformOptions = {
  siblingOption: {
    label: t('Sibling Package'),
    items: [
      {
        label: t('Angular 12+'),
        value: SiblingOption.ANGULARV12,
      },
      {
        label: t('Angular 10 & 11'),
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

// Note: platformOptions is defined in index.tsx where it's used
export type PlatformOptions = {
  siblingOption: PlatformOption<SiblingOption>;
};
export type Params = DocsParams<PlatformOptions>;

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

const getIntegrations = (params: Params): string[] => {
  const integrations: string[] = ['Sentry.browserTracingIntegration()'];

  if (params.isPerformanceSelected) {
    integrations.push(`
          new ${getSiblingImportName(params.platformOptions.siblingOption)}.BrowserTracing({
            // Set 'tracePropagationTargets' to control for which URLs distributed tracing should be enabled
            tracePropagationTargets: ["localhost", /^https:\\/\\/yourserver\\.io\\/api/],
          ${getPerformanceIntegration(params.platformOptions.siblingOption)}
          })`);
  }

  if (params.isReplaySelected) {
    integrations.push(
      `new ${getSiblingImportName(params.platformOptions.siblingOption)}.Replay(${getReplayConfigOptions(
        params.replayOptions
      )})`
    );
  }

  if (params.isFeedbackSelected) {
    integrations.push(`
      Sentry.feedbackIntegration({
        colorScheme: "system",
        ${getFeedbackConfigOptions(params.feedbackOptions)}
      })`);
  }

  return integrations;
};

const getDynamicParts = (params: Params): string[] => {
  const dynamicParts: string[] = [];

  if (params.isPerformanceSelected) {
    dynamicParts.push(`
      // Tracing
      tracesSampleRate: 1.0 //  Capture 100% of the transactions`);
  }

  if (params.isReplaySelected) {
    dynamicParts.push(`
      // Session Replay
      replaysSessionSampleRate: 0.1, // This sets the sample rate at 10%. You may want to change it to 100% while in development and then sample at a lower rate in production.
      replaysOnErrorSampleRate: 1.0 // If you're not already sampling the entire session, change the sample rate to 100% when sampling sessions where errors occur.`);
  }

  return dynamicParts;
};

const getStaticParts = (params: Params): string[] => {
  const staticParts = [`dsn: "${params.dsn.public}"`];

  if (params.platformOptions.siblingOption === SiblingOption.VUE2) {
    staticParts.unshift(`Vue`);
  } else if (params.platformOptions.siblingOption === SiblingOption.VUE3) {
    staticParts.unshift(`app`);
  }

  return staticParts;
};

export function getSetupConfiguration({
  params,
  showExtraStep,
  showDescription,
}: {
  params: Params;
  showExtraStep: boolean;
  showDescription?: boolean;
}): ContentBlock[] {
  const siblingOption = params.platformOptions.siblingOption;

  const config = buildSdkConfig({
    params,
    staticParts: getStaticParts(params),
    getIntegrations,
    getDynamicParts,
  });

  const configuration: ContentBlock[] = [];

  if (showDescription) {
    configuration.push({
      type: 'text',
      text: tct(
        `You should init the Sentry capacitor SDK in your [code:main.ts] file as soon as possible during application load up, before initializing Sentry [siblingName:]`,
        {
          siblingName: getSiblingName(siblingOption),
          code: <code />,
        }
      ),
    });
  }

  configuration.push({
    type: 'code',
    language: 'javascript',
    code: `${getSiblingImportsSetupConfiguration(siblingOption)}
    import * as Sentry from '@sentry/capacitor';
    import * as ${getSiblingImportName(siblingOption)} from '${getNpmPackage(
      siblingOption
    )}';
    ${getVueConstSetup(siblingOption)}
    Sentry.init({
      ${config}
},
// Forward the init method from ${getNpmPackage(params.platformOptions.siblingOption)}
${getSiblingImportName(siblingOption)}.init
);`,
  });

  if (isAngular(siblingOption) && showExtraStep) {
    configuration.push({
      type: 'text',
      text: t(
        "The Sentry Angular SDK exports a function to instantiate ErrorHandler provider that will automatically send JavaScript errors captured by the Angular's error handler."
      ),
    });
    configuration.push({
      type: 'code',
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

export function getNpmPackage(siblingOption: string): string {
  const packages: Record<SiblingOption, string> = {
    [SiblingOption.ANGULARV10]: '@sentry/angular',
    [SiblingOption.ANGULARV12]: '@sentry/angular-ivy',
    [SiblingOption.REACT]: '@sentry/react',
    [SiblingOption.VUE3]: '@sentry/vue',
    [SiblingOption.VUE2]: '@sentry/vue',
  };
  // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
  return packages[siblingOption];
}

export function getSiblingName(siblingOption: string): string {
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

export function getSiblingImportName(siblingOption: string): string {
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
