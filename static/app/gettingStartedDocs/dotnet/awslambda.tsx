import {Fragment} from 'react';

import ExternalLink from 'sentry/components/links/externalLink';
import {StepType} from 'sentry/components/onboarding/gettingStartedDoc/step';
import type {
  Docs,
  DocsParams,
  OnboardingConfig,
} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {
  getCrashReportGenericInstallStep,
  getCrashReportModalConfigDescription,
  getCrashReportModalIntroduction,
} from 'sentry/components/onboarding/gettingStartedDoc/utils/feedbackOnboarding';
import {csharpFeedbackOnboarding} from 'sentry/gettingStartedDocs/dotnet/dotnet';
import {t, tct} from 'sentry/locale';
import {getPackageVersion} from 'sentry/utils/gettingStartedDocs/getPackageVersion';

type Params = DocsParams;

const getInstallSnippetPackageManager = (params: Params) => `
Install-Package Sentry.AspNetCore -Version ${getPackageVersion(
  params,
  'sentry.dotnet.aspnetcore',
  '3.34.0'
)}`;

const getInstallSnippetCoreCli = (params: Params) => `
dotnet add package Sentry.AspNetCore -v ${getPackageVersion(
  params,
  'sentry.dotnet.aspnetcore',
  '3.34.0'
)}`;

const getConfigureSnippet = (params: Params) => `
public class LambdaEntryPoint : Amazon.Lambda.AspNetCoreServer.APIGatewayProxyFunction
{
    protected override void Init(IWebHostBuilder builder)
    {
        builder
            // Add Sentry
            .UseSentry(o =>
            {
              o.Dsn = "${params.dsn.public}";
              // When configuring for the first time, to see what the SDK is doing:
              o.Debug = true;
              // Required in Serverless environments
              o.FlushOnCompletedRequest = true;${
                params.isPerformanceSelected
                  ? `
              // Set TracesSampleRate to 1.0 to capture 100% of transactions for tracing.
              // We recommend adjusting this value in production.
              o.TracesSampleRate = 1.0;`
                  : ''
              }
            })
            .UseStartup<Startup>();
    }
}`;

const getVerifySnippet = () => `
[Route("api/[controller]")]
public class BadController
{
  [HttpGet]
  public string Get() => throw null;
}`;

const onboarding: OnboardingConfig = {
  introduction: () =>
    tct(
      'Sentry provides an integration with AWS Lambda ASP.NET Core Server through the Sentry.AspNetCore NuGet package.',
      {
        link: <ExternalLink href="https://www.nuget.org/packages/Sentry.AspNetCore" />,
      }
    ),
  install: params => [
    {
      type: StepType.INSTALL,
      description: t('Add the Sentry dependency:'),
      configurations: [
        {
          partialLoading: params.sourcePackageRegistries.isLoading,
          code: [
            {
              language: 'powershell',
              label: 'Package Manager',
              value: 'packageManager',
              code: getInstallSnippetPackageManager(params),
            },
            {
              language: 'shell',
              label: '.NET Core CLI',
              value: 'coreCli',
              code: getInstallSnippetCoreCli(params),
            },
          ],
        },
        {
          description: tct(
            'You can combine this integration with a logging library like [strong:log4net, NLog, or Serilog] to include both request data as well as your logs as breadcrumbs. The logging ingrations also capture events when an error is logged.',
            {strong: <strong />}
          ),
        },
      ],
    },
  ],
  configure: params => [
    {
      type: StepType.CONFIGURE,
      description: (
        <Fragment>
          <p>
            {tct(
              'All [code:ASP.NET Core] configurations are valid here. But one configuration in particular is relevant.',
              {
                code: <code />,
              }
            )}
          </p>
          <p>
            {tct(
              '[code:FlushOnCompletedRequest] ensures all events are flushed out. This is because the general ASP.NET Core hooks for when the process is exiting are not guaranteed to run in a serverless environment. This setting ensures that no event is lost if AWS recycles the process.',
              {
                code: <code />,
              }
            )}
          </p>
        </Fragment>
      ),
      configurations: [
        {
          language: 'csharp',
          code: getConfigureSnippet(params),
        },
      ],
    },
  ],
  verify: () => [
    {
      type: StepType.VERIFY,
      description: t(
        'You can verify your setup by throwing an exception from a function:'
      ),
      configurations: [
        {
          language: 'csharp',
          code: getVerifySnippet(),
        },
        {
          language: 'shell',
          description: t('And make a request to that lambda:'),
          code: 'curl -X GET -I https://url.of.server.aws/api/bad',
        },
      ],
      additionalInfo: tct(
        'Check out the [link:Sentry ASP.NET Core] documentation for the complete set of options.',
        {
          link: (
            <ExternalLink href="https://docs.sentry.io/platforms/dotnet/guides/aspnetcore/" />
          ),
        }
      ),
    },
  ],
};

const crashReportOnboarding: OnboardingConfig = {
  introduction: () => getCrashReportModalIntroduction(),
  install: (params: Params) => getCrashReportGenericInstallStep(params),
  configure: () => [
    {
      type: StepType.CONFIGURE,
      description: getCrashReportModalConfigDescription({
        link: 'https://docs.sentry.io/platforms/dotnet/guides/aws-lambda/user-feedback/configuration/#crash-report-modal',
      }),
    },
  ],
  verify: () => [],
  nextSteps: () => [],
};

const docs: Docs = {
  onboarding,
  feedbackOnboardingCrashApi: csharpFeedbackOnboarding,
  crashReportOnboarding,
};

export default docs;
