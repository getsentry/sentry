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
  ANGULARV14 = 'angularV14',
  ANGULARV12 = 'angularV12',
  ANGULARV10 = 'angularV10',
  REACT = 'react',
  VUE3 = 'vue3',
  VUE2 = 'vue2',
  NUXT = 'nuxt',
}

export const platformOptions: PlatformOptions = {
  siblingOption: {
    label: t('Sibling Package'),
    items: [
      {
        label: t('Angular 14+'),
        value: SiblingOption.ANGULARV14,
      },
      {
        label: t('Angular 12 & 13'),
        value: SiblingOption.ANGULARV12,
      },
      {
        label: t('React'),
        value: SiblingOption.REACT,
      },
      {
        label: t('Vue'),
        value: SiblingOption.VUE3,
      },
      {
        label: t('Nuxt'),
        value: SiblingOption.NUXT,
      },
    ],
  },
};

export type PlatformOptions = {
  siblingOption: PlatformOption<SiblingOption>;
};
export type Params = DocsParams<PlatformOptions>;

const isAngular = (siblingOption: string): boolean =>
  siblingOption === SiblingOption.ANGULARV10 ||
  siblingOption === SiblingOption.ANGULARV12 ||
  siblingOption === SiblingOption.ANGULARV14;

// Angular 12 & 13 use the legacy SDK API (V0)
const isLegacyAngular = (siblingOption: string): boolean =>
  siblingOption === SiblingOption.ANGULARV10 ||
  siblingOption === SiblingOption.ANGULARV12;

const isVue = (siblingOption: string): boolean =>
  siblingOption === SiblingOption.VUE2 || siblingOption === SiblingOption.VUE3;

const getIntegrations = (params: Params): string[] => {
  const siblingOption = params.platformOptions.siblingOption;
  const integrations: string[] = [];

  if (params.isPerformanceSelected) {
    integrations.push(
      isLegacyAngular(siblingOption)
        ? 'new Sentry.BrowserTracing()'
        : 'Sentry.browserTracingIntegration()'
    );
  }

  if (params.isReplaySelected) {
    integrations.push(
      isLegacyAngular(siblingOption)
        ? `new Sentry.Replay(${getReplayConfigOptions(params.replayOptions)})`
        : `Sentry.replayIntegration(${getReplayConfigOptions(params.replayOptions)})`
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
  const siblingOption = params.platformOptions.siblingOption;
  const dynamicParts: string[] = [];

  if (params.isPerformanceSelected) {
    dynamicParts.push(`
      // Tracing
      tracesSampleRate: 1.0, // Capture 100% of the transactions
      // Set 'tracePropagationTargets' to control for which URLs distributed tracing should be enabled
      tracePropagationTargets: ["localhost", /^https:\\/\\/yourserver\\.io\\/api/]`);
  }

  if (params.isReplaySelected) {
    dynamicParts.push(`
      // Session Replay
      replaysSessionSampleRate: 0.1, // This sets the sample rate at 10%. You may want to change it to 100% while in development and then sample at a lower rate in production.
      replaysOnErrorSampleRate: 1.0 // If you're not already sampling the entire session, change the sample rate to 100% when sampling sessions where errors occur.`);
  }

  // Logs requires @sentry/capacitor 2.0.0 or newer (Angular 14+ only for Angular)
  if (params.isLogsSelected) {
    if (isLegacyAngular(siblingOption)) {
      dynamicParts.push(`
      // Logs requires Angular 14 or newer.`);
    } else {
      dynamicParts.push(`
      // Enable logs to be sent to Sentry
      enableLogs: true`);
    }
  }

  return dynamicParts;
};

const getStaticParts = (params: Params): string[] => {
  const staticParts = [`dsn: "${params.dsn.public}"`];

  if (isVue(params.platformOptions.siblingOption)) {
    staticParts.push(`siblingOptions: {
    vueOptions: {
      app: app,
      attachErrorHandler: false,
      attachProps: true,
    },
  }`);
  }

  return staticParts;
};

function getSiblingImportsSetupConfiguration(siblingOption: string): string {
  if (siblingOption === SiblingOption.VUE3 || siblingOption === SiblingOption.VUE2) {
    return `import { createApp } from "vue";`;
  }
  return '';
}

function getVueConstSetup(siblingOption: string): string {
  if (siblingOption === SiblingOption.VUE3 || siblingOption === SiblingOption.VUE2) {
    return `
const app = createApp(App);
`;
  }
  return '';
}

const angularNgModuleAlwaysProviders = `{
  provide: SentryAngular.TraceService,
  deps: [Router],
},
{
  provide: APP_INITIALIZER,
  useFactory: () => () => {},
  deps: [SentryAngular.TraceService],
  multi: true,
},`;

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
        'You should init the Sentry capacitor SDK in your [code:main.ts] file as soon as possible during application load up, before initializing Sentry [siblingName:]',
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
import * as ${getSiblingImportName(siblingOption)} from '${getNpmPackage(siblingOption)}';
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

    // Angular 12 & 13 always include TraceService; Angular 14+ makes it conditional on performance
    const traceServiceProviders =
      isLegacyAngular(siblingOption) || params.isPerformanceSelected
        ? angularNgModuleAlwaysProviders
        : '';

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
}${traceServiceProviders ? `,\n${traceServiceProviders}` : ''}
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
    [SiblingOption.ANGULARV14]: '@sentry/angular',
    [SiblingOption.ANGULARV12]: '@sentry/angular-ivy',
    [SiblingOption.ANGULARV10]: '@sentry/angular',
    [SiblingOption.REACT]: '@sentry/react',
    [SiblingOption.VUE3]: '@sentry/vue',
    [SiblingOption.VUE2]: '@sentry/vue',
    [SiblingOption.NUXT]: '@sentry/nuxt',
  };
  // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
  return packages[siblingOption];
}

export function getSiblingName(siblingOption: string): string {
  switch (siblingOption) {
    case SiblingOption.ANGULARV14:
    case SiblingOption.ANGULARV12:
    case SiblingOption.ANGULARV10:
      return 'Angular';
    case SiblingOption.REACT:
      return 'React';
    case SiblingOption.VUE2:
    case SiblingOption.VUE3:
      return 'Vue';
    case SiblingOption.NUXT:
      return 'Nuxt';
    default:
      return '';
  }
}

export function getSiblingImportName(siblingOption: string): string {
  switch (siblingOption) {
    case SiblingOption.ANGULARV14:
    case SiblingOption.ANGULARV12:
    case SiblingOption.ANGULARV10:
      return 'SentryAngular';
    case SiblingOption.REACT:
      return 'SentryReact';
    case SiblingOption.VUE2:
    case SiblingOption.VUE3:
      return 'SentryVue';
    case SiblingOption.NUXT:
      return 'SentryNuxt';
    default:
      return '';
  }
}
