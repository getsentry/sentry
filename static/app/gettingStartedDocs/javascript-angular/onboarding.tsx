import {StepType} from 'sentry/components/onboarding/gettingStartedDoc/types';
import type {OnboardingConfig} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {getUploadSourceMapsStep} from 'sentry/components/onboarding/gettingStartedDoc/utils';
import {t, tct} from 'sentry/locale';

import {
  getSdkSetupSnippet,
  installSnippetBlock,
  isModuleConfig,
  type Params,
  type PlatformOptions,
} from './utils';

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
  params.isLogsSelected || params.isMetricsSelected
    ? 'import * as Sentry from "@sentry/angular";\n\n'
    : ''
}export class AppComponent {
  public throwTestError(): void {${
    params.isLogsSelected
      ? `
    // Send a log before throwing the error
    Sentry.logger.info(Sentry.logger.fmt\`User \${"sentry-test"} triggered test error button\`, {
      action: "test_error_button_click",
    });`
      : ''
  }${
    params.isMetricsSelected
      ? `
    // Send a test metric before throwing the error
    Sentry.metrics.count('test_counter', 1);`
      : ''
  }
    throw new Error("Sentry Test Error");
  }
}`;

export const onboarding: OnboardingConfig<PlatformOptions> = {
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

    if (params.isMetricsSelected) {
      steps.push({
        id: 'metrics',
        name: t('Metrics'),
        description: t(
          'Learn how to track custom metrics to monitor your application performance and business KPIs.'
        ),
        link: 'https://docs.sentry.io/platforms/javascript/guides/angular/metrics/',
      });
    }

    return steps;
  },
};
