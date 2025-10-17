import {ExternalLink} from 'sentry/components/core/link';
import type {
  Docs,
  DocsParams,
  OnboardingConfig,
} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {StepType} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {getUploadSourceMapsStep} from 'sentry/components/onboarding/gettingStartedDoc/utils';
import {
  getCrashReportApiIntroduction,
  getCrashReportInstallDescription,
  getCrashReportJavaScriptInstallSteps,
  getCrashReportModalConfigDescription,
  getCrashReportModalIntroduction,
} from 'sentry/components/onboarding/gettingStartedDoc/utils/feedbackOnboarding';
import {t, tct} from 'sentry/locale';
import {
  getImportInstrumentSnippet,
  getInstallConfig,
  getNodeAgentMonitoringOnboarding,
  getNodeLogsOnboarding,
  getNodeMcpOnboarding,
  getNodeProfilingOnboarding,
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

const getVerifySnippet = (params: Params) => `
@Get("/debug-sentry")
getError() {${
  params.isLogsSelected
    ? `
  // Send a log before throwing the error
  Sentry.logger.info('User triggered test error', {
    action: 'test_error_endpoint',
  });`
    : ''
}
  throw new Error("My first Sentry error!");
}
`;

const getDecoratedGlobalFilter =
  () => `import { Catch, ExceptionFilter } from '@nestjs/common';
import { SentryExceptionCaptured } from '@sentry/nestjs';

@Catch()
export class YourCatchAllExceptionFilter implements ExceptionFilter {
  @SentryExceptionCaptured()
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
      content: [
        {
          type: 'text',
          text: t('Add the Sentry NestJS SDK as a dependency:'),
        },
        {
          type: 'code',
          tabs: getInstallConfig(params, {
            basePackage: '@sentry/nestjs',
          })[0]!.code,
        },
      ],
    },
  ],
  configure: params => [
    {
      type: StepType.CONFIGURE,
      content: [
        {
          type: 'text',
          text: t(
            "Initialize Sentry as early as possible in your application's lifecycle."
          ),
        },
        {
          type: 'text',
          text: tct(
            'To initialize the SDK before everything else, create a file called [code:instrument.ts] in your [code:src/] folder.',
            {code: <code />}
          ),
        },
        {
          type: 'code',
          tabs: [
            {
              label: 'TypeScript',
              language: 'javascript',
              filename: 'instrument.ts',
              code: getSdkInitSnippet(params, 'nestjs', 'esm'),
            },
          ],
        },
        {
          type: 'text',
          text: tct(
            'Make sure to import [code:instrument.ts] at the top of your [code:main.ts] file:',
            {code: <code />}
          ),
        },
        {
          type: 'code',
          tabs: [
            {
              label: 'TypeScript',
              language: 'javascript',
              filename: 'main.ts',
              code: getSdkSetupSnippet(),
            },
          ],
        },
        {
          type: 'text',
          text: tct('Add the [code:SentryModule] as a root module to your main module:', {
            code: <code />,
            docs: (
              <ExternalLink href="https://docs.sentry.io/platforms/javascript/guides/nestjs/install/" />
            ),
          }),
        },
        {
          type: 'code',
          tabs: [
            {
              label: 'TypeScript',
              language: 'javascript',
              filename: 'app.module.ts',
              code: getAppModuleSnippet(),
            },
          ],
        },
        {
          type: 'text',
          text: tct(
            'If you are using a global catch-all exception filter add a [code:@SentryExceptionCaptured()] decorator to the [code:catch()] method of this global error filter. This will report all unhandled errors to Sentry',
            {
              code: <code />,
            }
          ),
        },
        {
          type: 'code',
          tabs: [
            {
              label: 'TypeScript',
              language: 'javascript',
              filename: 'global.filter.ts',
              code: getDecoratedGlobalFilter(),
            },
          ],
        },
        {
          type: 'text',
          text: tct(
            'Alternatively, add the [code:SentryGlobalFilter] before any other exception filters to the providers of your main module.',
            {
              code: <code />,
            }
          ),
        },
        {
          type: 'code',
          tabs: [
            {
              label: 'TypeScript',
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
  verify: (params: Params) => [
    {
      type: StepType.VERIFY,
      content: [
        {
          type: 'text',
          text: t(
            "This snippet contains an intentional error and can be used as a test to make sure that everything's working as expected."
          ),
        },
        {
          type: 'code',
          language: 'javascript',
          code: getVerifySnippet(params),
        },
      ],
    },
  ],
  nextSteps: (params: Params) => {
    const steps = [];

    if (params.isLogsSelected) {
      steps.push({
        id: 'logs',
        name: t('Logging Integrations'),
        description: t(
          'Add logging integrations to automatically capture logs from your application.'
        ),
        link: 'https://docs.sentry.io/platforms/javascript/guides/nestjs/logs/#integrations',
      });
    }

    return steps;
  },
};

const feedbackOnboardingNode: OnboardingConfig = {
  introduction: () => getCrashReportApiIntroduction(),
  install: () => [
    {
      type: StepType.INSTALL,
      content: [
        {
          type: 'text',
          text: getCrashReportInstallDescription(),
        },
        {
          type: 'code',
          tabs: [
            {
              label: 'TypeScript',
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
  install: (params: Params) => getCrashReportJavaScriptInstallSteps(params),
  configure: () => [
    {
      type: StepType.CONFIGURE,
      content: [
        {
          type: 'text',
          text: getCrashReportModalConfigDescription({
            link: 'https://docs.sentry.io/platforms/javascript/guides/nestjs/user-feedback/configuration/#crash-report-modal',
          }),
        },
      ],
    },
  ],
  verify: () => [],
  nextSteps: () => [],
};

const docs: Docs = {
  onboarding,
  feedbackOnboardingCrashApi: feedbackOnboardingNode,
  crashReportOnboarding,
  profilingOnboarding: getNodeProfilingOnboarding({
    basePackage: '@sentry/nestjs',
  }),
  logsOnboarding: getNodeLogsOnboarding({
    docsPlatform: 'nestjs',
    sdkPackage: '@sentry/nestjs',
  }),
  agentMonitoringOnboarding: getNodeAgentMonitoringOnboarding({
    basePackage: 'nestjs',
  }),
  mcpOnboarding: getNodeMcpOnboarding({
    basePackage: 'nestjs',
  }),
};

export default docs;
