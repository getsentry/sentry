import widgetCallout from 'sentry/components/onboarding/gettingStartedDoc/feedback/widgetCallout';
import {StepType} from 'sentry/components/onboarding/gettingStartedDoc/step';
import type {
  Docs,
  DocsParams,
  OnboardingConfig,
} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {
  getCrashReportJavaScriptInstallStep,
  getCrashReportModalConfigDescription,
  getCrashReportModalIntroduction,
} from 'sentry/components/onboarding/gettingStartedDoc/utils/feedbackOnboarding';
import {t, tct} from 'sentry/locale';

type Params = DocsParams;

const getConfigureSnippet = (params: Params) => `
import * as Sentry from "@sentry/capacitor";
// The example is using Angular 12+. Import '@sentry/angular' for Angular 10 and 11. Import '@sentry/vue' or '@sentry/react' when using a Sibling different than Angular.
import * as SentrySibling from "@sentry/angular-ivy";

Sentry.init(
  {
    dsn: "${params.dsn}",
    // To set your release and dist versions
    release: "my-project-name@" + process.env.npm_package_version,
    dist: "1",
    // Set tracesSampleRate to 1.0 to capture 100% of transactions for performance monitoring.
    // We recommend adjusting this value in production.
    tracesSampleRate: 1.0,
    integrations: [
      SentrySibling.browserTracingIntegration(),
    ],
    // Set "tracePropagationTargets" to control for which URLs distributed tracing should be enabled
    tracePropagationTargets: [
      "localhost",
      /^https:\/\/yourserver\.io\/api/,
    ],
  },
  // Forward the init method to the sibling Framework.
  SentrySibling.init
);`;

const getConfigureAngularSnippet = () => `
@NgModule({
  providers: [
    {
      provide: ErrorHandler,
      // Attach the Sentry ErrorHandler
      useValue: SentrySibling.createErrorHandler(),
    },
    {
      provide: SentrySibling.TraceService,
      deps: [Router],
    },
    {
      provide: APP_INITIALIZER,
      useFactory: () => () => {},
      deps: [SentrySibling.TraceService],
      multi: true,
    },
  ],
})`;

const onboarding: OnboardingConfig = {
  install: () => [
    {
      type: StepType.INSTALL,
      description: tct(
        "To use Sentry in your Ionic app, install the Sentry Capacitor SDK alongside the sibling Sentry SDK related to the Web framework you're using with Ionic. The supported siblings are: Angular [sentryAngularIvyCode:@sentry/angular-ivy], React [sentryReactCode:@sentry/react] and Vue [sentryVueCode:@sentry/vue].",
        {
          sentryAngularIvyCode: <code />,
          sentryReactCode: <code />,
          sentryVueCode: <code />,
        }
      ),
      configurations: [
        {
          language: 'bash',
          description: t(
            'Heres an example of installing Sentry Capacitor along with Sentry Angular:'
          ),
          code: [
            {
              language: 'bash',
              label: 'npm',
              value: 'npm',
              code: 'npm install --save @sentry/capacitor @sentry/angular',
            },
            {
              language: 'bash',
              label: 'yarn',
              value: 'yarn',
              code: 'yarn add @sentry/capacitor @sentry/angular',
            },
          ],
        },
      ],
      additionalInfo: tct(
        'The same installation process applies to the other siblings, all you need to do is to replace [code:@sentry/angular-ivy] by the desired sibling.',
        {code: <code />}
      ),
    },
  ],
  configure: params => [
    {
      type: StepType.CONFIGURE,
      description: tct('You must initialize the Sentry SDK as early as you can:', {
        code: <code />,
      }),
      configurations: [
        {
          language: 'javascript',
          code: getConfigureSnippet(params),
        },
        {
          language: 'javascript',
          description: tct(
            "Additionally for Angular, you will also need to configure your root [code:app.module.ts] (same code doesn't apply to other siblings):",
            {
              code: <code />,
            }
          ),
          code: getConfigureAngularSnippet(),
        },
      ],
    },
  ],
  verify: () => [
    {
      type: StepType.VERIFY,
      description: t(
        'This snippet includes an intentional error, so you can test that everything is working as soon as you set it up:'
      ),
      configurations: [
        {
          language: 'javascript',
          code: `
import * as Sentry from "@sentry/capacitor";

Sentry.captureException("Test Captured Exception");`,
        },
        {
          language: 'javascript',
          description: t('You can also throw an error anywhere in your application:'),
          code: `
// Must be thrown after Sentry.init is called to be captured.
throw new Error("Test Thrown Error");`,
        },
        {
          language: 'javascript',
          description: t('Or trigger a native crash:'),
          code: `
import * as Sentry from "@sentry/capacitor";

Sentry.nativeCrash();`,
        },
      ],
    },
  ],
  nextSteps: () => [
    {
      id: 'capacitor-android-setup',
      name: t('Capacitor 2 Setup'),
      description: t(
        'If you are using Capacitor 2 or older, follow this step to add required changes in order to initialize the Capacitor SDK on Android.'
      ),
      link: 'https://docs.sentry.io/platforms/javascript/guides/capacitor/ionic/#capacitor-2---android-specifics',
    },
  ],
};

const crashReportOnboarding: OnboardingConfig = {
  introduction: () => getCrashReportModalIntroduction(),
  install: (params: Params) => getCrashReportJavaScriptInstallStep(params),
  configure: () => [
    {
      type: StepType.CONFIGURE,
      description: getCrashReportModalConfigDescription({
        link: 'https://docs.sentry.io/platforms/javascript/guides/capacitor/user-feedback/configuration/#crash-report-modal',
      }),
      additionalInfo: widgetCallout({
        link: 'https://docs.sentry.io/platforms/javascript/guides/capacitor/user-feedback/#user-feedback-widget',
      }),
    },
  ],
  verify: () => [],
  nextSteps: () => [],
};

const docs: Docs = {
  onboarding,
  crashReportOnboarding,
};

export default docs;
