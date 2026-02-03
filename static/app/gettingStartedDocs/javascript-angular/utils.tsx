import {buildSdkConfig} from 'sentry/components/onboarding/gettingStartedDoc/buildSdkConfig';
import type {
  BasePlatformOptions,
  ContentBlock,
  DocsParams,
} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {getFeedbackConfigOptions} from 'sentry/components/onboarding/gettingStartedDoc/utils/feedbackOnboarding';
import {getReplayConfigOptions} from 'sentry/components/onboarding/gettingStartedDoc/utils/replayOnboarding';
import {t} from 'sentry/locale';

export enum AngularConfigType {
  APP = 'standalone',
  MODULE = 'module',
}

export const platformOptions = {
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

export type PlatformOptions = typeof platformOptions;
export type Params = DocsParams<PlatformOptions>;

export function isModuleConfig(params: Params) {
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
        // Set profileSessionSampleRate to 1.0 to profile during every session.
        // The decision, whether to profile or not, is made once per session (when the SDK is initialized).
        profileSessionSampleRate: 1.0`);
  }

  return dynamicParts;
};

export function getSdkSetupSnippet(params: Params) {
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

export const installSnippetBlock: ContentBlock = {
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
