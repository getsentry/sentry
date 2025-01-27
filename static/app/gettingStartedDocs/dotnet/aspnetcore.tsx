import {Fragment} from 'react';

import ExternalLink from 'sentry/components/links/externalLink';
import List from 'sentry/components/list';
import ListItem from 'sentry/components/list/listItem';
import {StepType} from 'sentry/components/onboarding/gettingStartedDoc/step';
import type {
  Docs,
  DocsParams,
  OnboardingConfig,
} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {
  getCrashReportModalConfigDescription,
  getCrashReportModalIntroduction,
  getCrashReportSDKInstallFirstStep,
} from 'sentry/components/onboarding/gettingStartedDoc/utils/feedbackOnboarding';
import {getDotnetMetricsOnboarding} from 'sentry/components/onboarding/gettingStartedDoc/utils/metricsOnboarding';
import {
  feedbackOnboardingJsLoader,
  replayOnboardingJsLoader,
} from 'sentry/gettingStartedDocs/javascript/jsLoader/jsLoader';
import {t, tct} from 'sentry/locale';
import {getPackageVersion} from 'sentry/utils/gettingStartedDocs/getPackageVersion';

type Params = DocsParams;

const getInstallSnippetPackageManager = (params: Params) => `
Install-Package Sentry.AspNetCore -Version ${getPackageVersion(
  params,
  'sentry.dotnet.aspnetcore',
  params.isProfilingSelected ? '4.3.0' : '3.34.0'
)}`;

const getInstallSnippetCoreCli = (params: Params) => `
dotnet add package Sentry.AspNetCore -v ${getPackageVersion(
  params,
  'sentry.dotnet.aspnetcore',
  params.isProfilingSelected ? '4.3.0' : '3.34.0'
)}`;

const getInstallProfilingSnippetPackageManager = (params: Params) => `
Install-Package Sentry.Profiling -Version ${getPackageVersion(
  params,
  'sentry.dotnet.profiling',
  '4.3.0'
)}`;

const getInstallProfilingSnippetCoreCli = (params: Params) => `
dotnet add package Sentry.Profiling -v ${getPackageVersion(
  params,
  'sentry.dotnet.profiling',
  '4.3.0'
)}`;

const getConfigureSnippet = (params: Params) => `
public static IHostBuilder CreateHostBuilder(string[] args) =>
  Host.CreateDefaultBuilder(args)
      .ConfigureWebHostDefaults(webBuilder =>
      {
          // Add the following line:
          webBuilder.UseSentry(o =>
          {
              o.Dsn = "${params.dsn.public}";
              // When configuring for the first time, to see what the SDK is doing:
              o.Debug = true;${
                params.isPerformanceSelected
                  ? `
              // Set TracesSampleRate to 1.0 to capture 100%
              // of transactions for tracing.
              // We recommend adjusting this value in production
              o.TracesSampleRate = 1.0;`
                  : ''
              }${
                params.isProfilingSelected
                  ? `
              // Sample rate for profiling, applied on top of othe TracesSampleRate,
              // e.g. 0.2 means we want to profile 20 % of the captured transactions.
              // We recommend adjusting this value in production.
              o.ProfilesSampleRate = 1.0;
              // Requires NuGet package: Sentry.Profiling
              // Note: By default, the profiler is initialized asynchronously. This can
              // be tuned by passing a desired initialization timeout to the constructor.
              o.AddIntegration(new ProfilingIntegration(
                  // During startup, wait up to 500ms to profile the app startup code.
                  // This could make launching the app a bit slower so comment it out if you
                  // prefer profiling to start asynchronously.
                  TimeSpan.FromMilliseconds(500)
              ));`
                  : ''
              }
          });
      });`;

const getPerformanceSpansSnippet = () => `
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging;
using Sentry;

public class HomeController : Controller
{
    private readonly IHub _sentryHub;

    public HomeController(IHub sentryHub) => _sentryHub = sentryHub;

    [HttpGet("/person/{id}")]
    public IActionResult Person(string id)
    {
        var childSpan = _sentryHub.GetSpan()?.StartChild("additional-work");
        try
        {
            // Do the work that gets measured.

            childSpan?.Finish(SpanStatus.Ok);
        }
        catch (Exception e)
        {
            childSpan?.Finish(e);
            throw;
        }
    }
}`;

const onboarding: OnboardingConfig = {
  install: params => [
    {
      type: StepType.INSTALL,
      description: tct('Install the [strong:NuGet] package:', {
        strong: <strong />,
      }),
      configurations: [
        {
          partialLoading: params.sourcePackageRegistries.isLoading,
          code: [
            {
              language: 'shell',
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
        ...(params.isProfilingSelected
          ? [
              {
                code: [
                  {
                    language: 'shell',
                    label: 'Package Manager',
                    value: 'packageManager',
                    code: getInstallProfilingSnippetPackageManager(params),
                  },
                  {
                    language: 'shell',
                    label: '.NET Core CLI',
                    value: 'coreCli',
                    code: getInstallProfilingSnippetCoreCli(params),
                  },
                ],
              },
            ]
          : []),
      ],
    },
  ],
  configure: params => [
    {
      type: StepType.CONFIGURE,
      description: tct(
        'Add Sentry to [code:Program.cs] through the [code:WebHostBuilder]:',
        {
          code: <code />,
        }
      ),
      configurations: [
        {
          language: 'csharp',
          code: getConfigureSnippet(params),
        },
      ],
    },
  ],
  verify: params => [
    {
      type: StepType.VERIFY,
      description: t('To verify your set up, you can capture a message with the SDK:'),
      configurations: [
        {
          language: 'csharp',
          code: 'SentrySdk.CaptureMessage("Hello Sentry");',
        },
      ],
      additionalInfo: tct(
        "If you don't want to depend on the static class, the SDK registers a client in the DI container. In this case, you can [link:take [code:IHub] as a dependency].",
        {
          code: <code />,
          link: (
            <ExternalLink href="https://docs.sentry.io/platforms/dotnet/guides/aspnetcore/unit-testing/" />
          ),
        }
      ),
    },
    ...(params.isPerformanceSelected
      ? [
          {
            title: t('Tracing'),
            description: tct(
              'You can measure the performance of your endpoints by adding a middleware to [code:Startup.cs]:',
              {
                code: <code />,
              }
            ),
            configurations: [
              {
                description: t(
                  "You'll be able to monitor the performance of your actions automatically. To add additional spans to it, you can use the API:"
                ),
                language: 'csharp',
                code: getPerformanceSpansSnippet(),
              },
            ],
          },
        ]
      : []),
    {
      title: t('Samples'),
      description: (
        <Fragment>
          {t(
            'See the following examples that demonstrate how to integrate Sentry with various frameworks.'
          )}
          <List symbol="bullet">
            <ListItem>
              {tct(
                '[link:Multiple samples in the [code:dotnet] SDK repository] [strong:(C#)]',
                {
                  link: (
                    <ExternalLink href="https://github.com/getsentry/sentry-dotnet/tree/main/samples" />
                  ),
                  code: <code />,
                  strong: <strong />,
                }
              )}
            </ListItem>
            <ListItem>
              {tct('[link:Basic F# sample] [strong:(F#)]', {
                link: <ExternalLink href="https://github.com/sentry-demos/fsharp" />,
                strong: <strong />,
              })}
            </ListItem>
            <ListItem>
              {tct('[link:Giraffe F# sample] [strong:(F#)]', {
                link: <ExternalLink href="https://github.com/sentry-demos/giraffe" />,
                strong: <strong />,
              })}
            </ListItem>
          </List>
        </Fragment>
      ),
    },
  ],
};

const crashReportOnboarding: OnboardingConfig = {
  introduction: () => getCrashReportModalIntroduction(),
  install: (params: Params) => [
    {
      type: StepType.INSTALL,
      configurations: [
        getCrashReportSDKInstallFirstStep(params),
        {
          description: tct(
            'If you are rendering the page from the server, for example on ASP.NET MVC, the [code:Error.cshtml] razor page can be:',
            {code: <code />}
          ),
          code: [
            {
              label: 'cshtml',
              value: 'html',
              language: 'html',
              code: `@using Sentry
@using Sentry.AspNetCore
@inject Microsoft.Extensions.Options.IOptions<SentryAspNetCoreOptions> SentryOptions

@if (SentrySdk.LastEventId != SentryId.Empty) {
  <script>
    Sentry.init({ dsn: "@(SentryOptions.Value.Dsn)" });
    Sentry.showReportDialog({ eventId: "@SentrySdk.LastEventId" });
  </script>
}`,
            },
          ],
        },
      ],
    },
  ],
  configure: () => [
    {
      type: StepType.CONFIGURE,
      description: getCrashReportModalConfigDescription({
        link: 'https://docs.sentry.io/platforms/dotnet/guides/aspnetcore/user-feedback/configuration/#crash-report-modal',
      }),
    },
  ],
  verify: () => [],
  nextSteps: () => [],
};

const docs: Docs = {
  onboarding,
  replayOnboardingJsLoader,
  customMetricsOnboarding: getDotnetMetricsOnboarding({packageName: 'Sentry.AspNetCore'}),
  crashReportOnboarding,
  feedbackOnboardingJsLoader,
};

export default docs;
