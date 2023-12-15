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
import replayOnboardingJsLoader from 'sentry/gettingStartedDocs/javascript/jsLoader/jsLoader';
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
public static IHostBuilder CreateHostBuilder(string[] args) =>
  Host.CreateDefaultBuilder(args)
      .ConfigureWebHostDefaults(webBuilder =>
      {
          // Add the following line:
          webBuilder.UseSentry(o =>
          {
              o.Dsn = "${params.dsn}";
              // When configuring for the first time, to see what the SDK is doing:
              o.Debug = true;
              // Set TracesSampleRate to 1.0 to capture 100% of transactions for performance monitoring.
              // We recommend adjusting this value in production.
              o.TracesSampleRate = 1.0;
          });
      });`;

const getPerformanceMiddlewareSnippet = () => `
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Sentry.AspNetCore;

public class Startup
{
    public void Configure(IApplicationBuilder app, IWebHostEnvironment env)
    {
        app.UseRouting();

        // Enable automatic tracing integration.
        // If running with .NET 5 or below, make sure to put this middleware
        // right after "UseRouting()".
        app.UseSentryTracing();

        app.UseEndpoints(endpoints =>
        {
            endpoints.MapControllerRoute(
                name: "default",
                pattern: "{controller=Home}/{action=Index}/{id?}");
        });
    }
}`;

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
      ],
    },
  ],
  configure: params => [
    {
      type: StepType.CONFIGURE,
      description: tct(
        'Add Sentry to [programCode:Program.cs] through the [webHostCode:WebHostBuilder]:',
        {
          webHostCode: <code />,
          programCode: <code />,
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
  verify: () => [
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
    {
      title: t('Performance Monitoring'),
      description: tct(
        'You can measure the performance of your endpoints by adding a middleware to [code:Startup.cs]:',
        {
          code: <code />,
        }
      ),
      configurations: [
        {
          language: 'csharp',
          code: getPerformanceMiddlewareSnippet(),
        },
        {
          description: t(
            "You'll be able to monitor the performance of your actions automatically. To add additional spans to it, you can use the API:"
          ),
          language: 'csharp',
          code: getPerformanceSpansSnippet(),
        },
      ],
    },
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

const docs: Docs = {
  onboarding,
  replayOnboardingJsLoader,
};

export default docs;
