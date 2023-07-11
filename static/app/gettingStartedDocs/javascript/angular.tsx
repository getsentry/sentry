import styled from '@emotion/styled';

import List from 'sentry/components/list/';
import ListItem from 'sentry/components/list/listItem';
import {Layout, LayoutProps} from 'sentry/components/onboarding/gettingStartedDoc/layout';
import {StepType} from 'sentry/components/onboarding/gettingStartedDoc/step';
import {getUploadSourceMapsStep} from 'sentry/components/onboarding/gettingStartedDoc/utils';
import {ProductSolution} from 'sentry/components/onboarding/productSelection';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';

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
}: {
  errorHandlerProviders?: string;
  sentryInitContent?: string;
} = {}): LayoutProps['steps'] => [
  {
    language: 'bash',
    type: StepType.INSTALL,

    description: (
      <InstallDescription>
        <div>
          {tct(
            "To use Sentry with your Angular application, you'll need [code:@sentry/angular-ivy] or [code:@sentry/angular], Sentry’s Browser Angular SDKs:",
            {
              code: <code />,
            }
          )}
        </div>
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
        <div>
          {tct('Add the Sentry SDK as a dependency using [code:yarn] or [code:npm]:', {
            code: <code />,
          })}
        </div>
      </InstallDescription>
    ),
    configurations: [
      {
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
    language: 'javascript',
    type: StepType.CONFIGURE,
    description: t(
      'You should init the Sentry browser SDK in your main.ts file as soon as possible during application load up, before initializing Angular:'
    ),
    configurations: [
      {
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
  getUploadSourceMapsStep(
    'https://docs.sentry.io/platforms/javascript/guides/angular/sourcemaps/'
  ),
  {
    language: 'javascript',
    type: StepType.VERIFY,
    description: t(
      "This snippet contains an intentional error and can be used as a test to make sure that everything's working as expected."
    ),
    configurations: [
      {
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

type Props = {
  activeProductSelection: ProductSolution[];
  dsn: string;
  newOrg?: boolean;
};

export default function GettingStartedWithAngular({
  dsn,
  newOrg,
  activeProductSelection,
}: Props) {
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
      })}
      nextSteps={nextStepDocs}
      newOrg={newOrg}
    />
  );
}

const InstallDescription = styled('div')`
  display: flex;
  flex-direction: column;
  gap: ${space(1)};
`;
