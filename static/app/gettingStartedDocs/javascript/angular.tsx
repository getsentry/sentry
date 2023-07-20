import styled from '@emotion/styled';

import List from 'sentry/components/list/';
import ListItem from 'sentry/components/list/listItem';
import {Layout, LayoutProps} from 'sentry/components/onboarding/gettingStartedDoc/layout';
import {ModuleProps} from 'sentry/components/onboarding/gettingStartedDoc/sdkDocumentation';
import {StepType} from 'sentry/components/onboarding/gettingStartedDoc/step';
import {getUploadSourceMapsStep} from 'sentry/components/onboarding/gettingStartedDoc/utils';
import {ProductSolution} from 'sentry/components/onboarding/productSelection';
import {PlatformKey} from 'sentry/data/platformCategories';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Organization} from 'sentry/types';

type StepProps = {
  organization: Organization;
  projectId: string;
  errorHandlerProviders?: string;
  newOrg?: boolean;
  platformKey?: PlatformKey;
  sentryInitContent?: string;
};

// Configuration Start
const replayIntegration = `
new Sentry.Replay(),
`;

const replayOtherConfig = `
// Session Replay
replaysSessionSampleRate: 0.1, // This sets the sample rate at 10%. You may want to change it to 100% while in development and then sample at a lower rate in production.
replaysOnErrorSampleRate: 1.0, // If you're not already sampling the entire session, change the sample rate to 100% when sampling sessions where errors occur.
`;

const performanceIntegration = `
new Sentry.BrowserTracing({
  // Set 'tracePropagationTargets' to control for which URLs distributed tracing should be enabled
  tracePropagationTargets: ["localhost", "https:yourserver.io/api/"],
  routingInstrumentation: Sentry.routingInstrumentation,
}),
`;

const performanceOtherConfig = `
// Performance Monitoring
tracesSampleRate: 1.0, // Capture 100% of the transactions, reduce in production!
`;

const performanceErrorHandler = `
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
`;

export const steps = ({
  sentryInitContent,
  errorHandlerProviders,
  ...props
}: Partial<StepProps> = {}): LayoutProps['steps'] => [
  {
    type: StepType.INSTALL,
    description: (
      <InstallDescription>
        <p>
          {tct(
            "To use Sentry with your Angular application, you'll need [code:@sentry/angular-ivy] or [code:@sentry/angular], Sentry’s Browser Angular SDKs:",
            {
              code: <code />,
            }
          )}
        </p>
        <List symbol="bullet">
          <ListItem>
            {tct("If you're using Angular 12 or newer, use [code:@sentry/angular-ivy]", {
              code: <code />,
            })}
          </ListItem>
          <ListItem>
            {tct("If you're using Angular 10 or 11, use [code:@sentry/angular]", {
              code: <code />,
            })}
          </ListItem>
        </List>
        <p>
          {tct('Add the Sentry SDK as a dependency using [code:yarn] or [code:npm]:', {
            code: <code />,
          })}
        </p>
      </InstallDescription>
    ),
    configurations: [
      {
        language: 'bash',
        code: `
# Using yarn (Angular 12+)
yarn add @sentry/angular-ivy
# Using yarn (Angular 10 and 11)
yarn add @sentry/angular

# Using npm (Angular 12+)
npm install --save @sentry/angular-ivy
# Using npm (Angular 10 and 11)
npm install --save @sentry/angular
        `,
      },
    ],
  },
  {
    type: StepType.CONFIGURE,
    description: t(
      'You should init the Sentry browser SDK in your main.ts file as soon as possible during application load up, before initializing Angular:'
    ),
    configurations: [
      {
        language: 'javascript',
        code: `
        import { enableProdMode } from "@angular/core";
        import { platformBrowserDynamic } from "@angular/platform-browser-dynamic";
        // import * as Sentry from "@sentry/angular" // for Angular 10/11 instead
        import * as Sentry from "@sentry/angular-ivy";

        import { AppModule } from "./app/app.module";

        Sentry.init({
          ${sentryInitContent}
        });

        enableProdMode();
        platformBrowserDynamic()
          .bootstrapModule(AppModule)
          .then((success) => console.log('Bootstrap success'))
          .catch((err) => console.error(err));
        `,
      },
      {
        description: t(
          "The Sentry Angular SDK exports a function to instantiate ErrorHandler provider that will automatically send JavaScript errors captured by the Angular's error handler."
        ),
        language: 'javascript',
        code: `
        import { APP_INITIALIZER, ErrorHandler, NgModule } from "@angular/core";
        import { Router } from "@angular/router";
        // import * as Sentry from "@sentry/angular" // for Angular 10/11 instead
        import * as Sentry from "@sentry/angular-ivy";

        @NgModule({
          // ...
          providers: [
            {
              provide: ErrorHandler,
              useValue: Sentry.createErrorHandler({
                showDialog: true,
              }),
            },${errorHandlerProviders}
          ],
          // ...
        })
        export class AppModule {}
        `,
      },
    ],
  },
  getUploadSourceMapsStep({
    guideLink: 'https://docs.sentry.io/platforms/javascript/guides/angular/sourcemaps/',
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
// Configuration End

export function GettingStartedWithAngular({
  dsn,
  activeProductSelection = [],
  organization,
  newOrg,
  platformKey,
  projectId,
}: ModuleProps) {
  const integrations: string[] = [];
  const otherConfigs: string[] = [];

  let nextStepDocs = [...nextSteps];
  const errorHandlerProviders: string[] = [];

  if (activeProductSelection.includes(ProductSolution.PERFORMANCE_MONITORING)) {
    integrations.push(performanceIntegration.trim());
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

  let sentryInitContent: string[] = [`dsn: "${dsn}",`];

  if (integrations.length > 0) {
    sentryInitContent = sentryInitContent.concat('integrations: [', integrations, '],');
  }

  if (otherConfigs.length > 0) {
    sentryInitContent = sentryInitContent.concat(otherConfigs);
  }

  return (
    <Layout
      steps={steps({
        sentryInitContent: sentryInitContent.join('\n'),
        errorHandlerProviders: errorHandlerProviders.join('\n'),
        organization,
        newOrg,
        platformKey,
        projectId,
      })}
      nextSteps={nextStepDocs}
      newOrg={newOrg}
      platformKey={platformKey}
    />
  );
}

export default GettingStartedWithAngular;

const InstallDescription = styled('div')`
  display: flex;
  flex-direction: column;
  gap: ${space(1)};
`;
