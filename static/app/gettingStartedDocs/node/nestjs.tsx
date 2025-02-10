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
import {t, tct} from 'sentry/locale';
import {
  getImportInstrumentSnippet,
  getInstallConfig,
  getSdkInitSnippet,
} from 'sentry/utils/gettingStartedDocs/node';

type Params = DocsParams;

const getSdkSetupSnippet = () => `
${getImportInstrumentSnippet('esm', 'ts')}

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
  introduction: () =>
    tct('In this quick guide you’ll use [strong:npm] or [strong:yarn] to set up:', {
      strong: <strong />,
    }),
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
        "Initialize Sentry as early as possible in your application's lifecycle."
      ),
      configurations: [
        {
          description: tct(
            'To initialize the SDK before everything else, create a file called [code:instrument.ts] in your [code:src/] folder.',
            {code: <code />}
          ),
          code: [
            {
              label: 'TypeScript',
              value: 'javascript',
              language: 'javascript',
              filename: 'instrument.ts',
              code: getSdkInitSnippet(params, 'nestjs', 'esm'),
            },
          ],
        },
        {
          description: tct(
            'Make sure to import [code:instrument.ts] at the top of your [code:main.ts] file:',
            {
              code: <code />,
              docs: (
                <ExternalLink href="https://docs.sentry.io/platforms/javascript/guides/nestjs/install/" />
              ),
            }
          ),
          code: [
            {
              label: 'TypeScript',
              value: 'javascript',
              language: 'javascript',
              filename: 'main.ts',
              code: getSdkSetupSnippet(),
            },
          ],
        },
        {
          description: tct(
            'Add the [code:SentryModule] as a root module to your main module:',
            {
              code: <code />,
              docs: (
                <ExternalLink href="https://docs.sentry.io/platforms/javascript/guides/nestjs/install/" />
              ),
            }
          ),
          code: [
            {
              label: 'TypeScript',
              value: 'javascript',
              language: 'javascript',
              filename: 'app.module.ts',
              code: getAppModuleSnippet(),
            },
          ],
        },
        {
          description: tct(
            'If you are using a global catch-all exception filter add a [code:@WithSentry()] decorator to the [code:catch()] method of this global error filter. This will report all unhandled errors to Sentry',
            {
              code: <code />,
            }
          ),
          code: [
            {
              label: 'TypeScript',
              value: 'javascript',
              language: 'javascript',
              filename: 'global.filter.ts',
              code: getDecoratedGlobalFilter(),
            },
          ],
        },
        {
          description: tct(
            'Alternatively, add the [code:SentryGlobalFilter] (or [code:SentryGlobalGraphQLFilter] if you are using GraphQL) before any other exception filters to the providers of your main module.',
            {
              code: <code />,
            }
          ),
          code: [
            {
              label: 'TypeScript',
              value: 'javascript',
              language: 'javascript',
              filename: 'app.module.ts',
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
              label: 'TypeScript',
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

const profilingOnboarding: OnboardingConfig = {
  ...onboarding,
  introduction: () => null,
};

const docs: Docs = {
  onboarding,
  feedbackOnboardingCrashApi: feedbackOnboardingNode,

  crashReportOnboarding,
  profilingOnboarding,
};

export default docs;
