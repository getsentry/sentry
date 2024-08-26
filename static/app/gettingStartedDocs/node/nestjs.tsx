import ExternalLink from 'sentry/components/links/externalLink';
import {StepType} from 'sentry/components/onboarding/gettingStartedDoc/step';
import type {
  Docs,
  DocsParams,
  OnboardingConfig,
} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {getUploadSourceMapsStep} from 'sentry/components/onboarding/gettingStartedDoc/utils';
import {
  getCrashReportApiIntroduction,
  getCrashReportInstallDescription,
  getCrashReportJavaScriptInstallStep,
  getCrashReportModalConfigDescription,
  getCrashReportModalIntroduction,
} from 'sentry/components/onboarding/gettingStartedDoc/utils/feedbackOnboarding';
import {getJSServerMetricsOnboarding} from 'sentry/components/onboarding/gettingStartedDoc/utils/metricsOnboarding';
import {t, tct} from 'sentry/locale';
import {
  getImportInstrumentSnippet,
  getInstallConfig,
  getSdkInitSnippet,
} from 'sentry/utils/gettingStartedDocs/node';

type Params = DocsParams;

const getSdkSetupSnippet = () => `
${getImportInstrumentSnippet('esm')}

// All other imports below
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  await app.listen(3000);
}

bootstrap();
`;

const getAppModuleSnippet = () => `
import { Module } from '@nestjs/common';
import { SentryModule } from '@sentry/nestjs/setup';
import { AppController } from './app.controller';
import { AppService } from './app.service';

@Module({
  imports: [
    SentryModule.forRoot(),
    // ...other modules
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
`;

const getVerifySnippet = () => `
@Get("/debug-sentry")
getError() {
  throw new Error("My first Sentry error!");
}
`;

const getDecoratedGlobalFilter =
  () => `import { Catch, ExceptionFilter } from '@nestjs/common';
import { WithSentry } from '@sentry/nestjs';

@Catch()
export class YourCatchAllExceptionFilter implements ExceptionFilter {
  @WithSentry()
  catch(exception, host): void {
    // your implementation here
  }
}
`;

const getAppModuleSnippetWithSentryGlobalFilter =
  () => `import { Module } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { SentryGlobalFilter } from '@sentry/nestjs/setup';

@Module({
  providers: [
    {
      provide: APP_FILTER,
      useClass: SentryGlobalFilter,
    },
    // ..other providers
  ],
})
export class AppModule {}
`;

const onboarding: OnboardingConfig = {
  install: params => [
    {
      type: StepType.INSTALL,
      description: t('Add the Sentry NestJS SDK as a dependency:'),
      configurations: getInstallConfig(params, {
        basePackage: '@sentry/nestjs',
      }),
    },
  ],
  configure: params => [
    {
      type: StepType.CONFIGURE,
      description: t(
        "Initialize Sentry as early as possible in your application's lifecycle. Otherwise, auto-instrumentation will not work."
      ),
      configurations: [
        {
          description: tct(
            'To initialize the SDK before everything else, create an external file called [code:instrument.js/mjs].',
            {code: <code />}
          ),
          code: [
            {
              label: 'JavaScript',
              value: 'javascript',
              language: 'javascript',
              filename: 'instrument.(js|ts)',
              code: getSdkInitSnippet(params, 'nestjs', 'esm'),
            },
          ],
        },
        {
          description: tct(
            'Import [code1:instrument.js/mjs] in your [code2:main.ts/js] file:',
            {
              code1: <code />,
              code2: <code />,
              docs: (
                <ExternalLink href="https://docs.sentry.io/platforms/javascript/guides/nestjs/install/" />
              ),
            }
          ),
          code: [
            {
              label: 'JavaScript',
              value: 'javascript',
              language: 'javascript',
              filename: 'main.(js|ts)',
              code: getSdkSetupSnippet(),
            },
          ],
        },
        {
          description: tct(
            'Afterwards, add the [code1:SentryModule] as a root module to your main module:',
            {
              code1: <code />,
              docs: (
                <ExternalLink href="https://docs.sentry.io/platforms/javascript/guides/nestjs/install/" />
              ),
            }
          ),
          code: [
            {
              label: 'JavaScript',
              value: 'javascript',
              language: 'javascript',
              filename: 'app.module.(js|ts)',
              code: getAppModuleSnippet(),
            },
          ],
        },
        {
          description: tct(
            'In case you are using a global catch-all exception filter (which is either a filter registered with [code1:app.useGlobalFilters()] or a filter registered in your app module providers annotated with a [code2:@Catch()] decorator without arguments), add a [code3:@WithSentry()] decorator to the [code4:catch()] method of this global error filter. This decorator will report all unexpected errors that are received by your global error filter to Sentry:',
            {
              code1: <code />,
              code2: <code />,
              code3: <code />,
              code4: <code />,
            }
          ),
          code: [
            {
              label: 'JavaScript',
              value: 'javascript',
              language: 'javascript',
              filename: 'global.filter.(js|ts)',
              code: getDecoratedGlobalFilter(),
            },
          ],
        },
        {
          description: tct(
            'In case you do not have a global catch-all exception filter, add the [code1:SentryGlobalFilter] to the providers of your main module. This filter will report all unhandled errors to Sentry that are not caught by any other error filter. Important: The [code2:SentryGlobalFilter] needs to be registered before any other exception filters.',
            {
              code1: <code />,
              code2: <code />,
            }
          ),
          code: [
            {
              label: 'JavaScript',
              value: 'javascript',
              language: 'javascript',
              filename: 'app.module.(js|ts)',
              code: getAppModuleSnippetWithSentryGlobalFilter(),
            },
          ],
        },
      ],
    },
    getUploadSourceMapsStep({
      guideLink: 'https://docs.sentry.io/platforms/javascript/guides/nestjs/sourcemaps/',
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
          code: getVerifySnippet(),
        },
      ],
    },
  ],
};

const feedbackOnboardingNode: OnboardingConfig = {
  introduction: () => getCrashReportApiIntroduction(),
  install: () => [
    {
      type: StepType.INSTALL,
      description: getCrashReportInstallDescription(),
      configurations: [
        {
          code: [
            {
              label: 'JavaScript',
              value: 'javascript',
              language: 'javascript',
              code: `import * as Sentry from "@sentry/node";

const eventId = Sentry.captureMessage("User Feedback");
// OR: const eventId = Sentry.lastEventId();

const userFeedback = {
  event_id: eventId,
  name: "John Doe",
  email: "john@doe.com",
  comments: "I really like your App, thanks!",
};
Sentry.captureUserFeedback(userFeedback);
`,
            },
          ],
        },
      ],
    },
  ],
  configure: () => [],
  verify: () => [],
  nextSteps: () => [],
};

const crashReportOnboarding: OnboardingConfig = {
  introduction: () => getCrashReportModalIntroduction(),
  install: (params: Params) => getCrashReportJavaScriptInstallStep(params),
  configure: () => [
    {
      type: StepType.CONFIGURE,
      description: getCrashReportModalConfigDescription({
        link: 'https://docs.sentry.io/platforms/javascript/guides/nestjs/user-feedback/configuration/#crash-report-modal',
      }),
    },
  ],
  verify: () => [],
  nextSteps: () => [],
};

const docs: Docs = {
  onboarding,
  feedbackOnboardingCrashApi: feedbackOnboardingNode,
  customMetricsOnboarding: getJSServerMetricsOnboarding(),
  crashReportOnboarding,
};

export default docs;
