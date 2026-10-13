import {ExternalLink} from '@sentry/scraps/link';

import type {
  DocsParams,
  OnboardingConfig,
  OnboardingStep,
} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {StepType} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {logsVerify} from 'sentry/gettingStartedDocs/dotnet/logs';
import {metricsVerify} from 'sentry/gettingStartedDocs/dotnet/metrics';
import {t, tct} from 'sentry/locale';
import {getPackageVersion} from 'sentry/utils/gettingStartedDocs/getPackageVersion';

const getInstallSnippetPackageManager = (params: DocsParams) => `
Install-Package Sentry.AspNetCore -Version ${getPackageVersion(
  params,
  'sentry.dotnet.aspnetcore',
  '6.12.0'
)}`;

const getInstallSnippetCoreCli = (params: DocsParams) => `
dotnet add package Sentry.AspNetCore -v ${getPackageVersion(
  params,
  'sentry.dotnet.aspnetcore',
  '6.12.0'
)}`;

const getSentryOptions = (params: DocsParams, indent: string) =>
  `
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
    params.isLogsSelected
      ? `
// Enable logs to be sent to Sentry
o.EnableLogs = true;`
      : ''
  }`.replaceAll('\n', `\n${indent}`);

const getConfigureWebApplicationSnippet = (params: DocsParams) => `
var builder = WebApplication.CreateBuilder(args);

// Add the following line:
builder.WebHost.UseSentry(o =>
{${getSentryOptions(params, '    ')}
});

var app = builder.Build();`;

const getConfigureHostBuilderSnippet = (params: DocsParams) => `
public static IHostBuilder CreateHostBuilder(string[] args) =>
  Host.CreateDefaultBuilder(args)
      .ConfigureWebHostDefaults(webBuilder =>
      {
          webBuilder.UseStartup<Startup>();
          // Add the following line:
          webBuilder.UseSentry(o =>
          {${getSentryOptions(params, '              ')}
          });
      });`;

const getPerformanceSpansMinimalApiSnippet = () => `
app.MapGet("/person/{id}", (string id, IHub hub) =>
{
    var childSpan = hub.GetSpan()?.StartChild("additional-work");
    try
    {
        // Do the work that gets measured.

        childSpan?.Finish(SpanStatus.Ok);
        return Results.Ok();
    }
    catch (Exception e)
    {
        childSpan?.Finish(e);
        throw;
    }
});`;

const getPerformanceSpansControllerSnippet = () => `
using Microsoft.AspNetCore.Mvc;
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
            return Ok();
        }
        catch (Exception e)
        {
            childSpan?.Finish(e);
            throw;
        }
    }
}`;

export const onboarding: OnboardingConfig = {
  install: params => [
    {
      type: StepType.INSTALL,
      content: [
        {
          type: 'text',
          text: tct('Install the [strong:NuGet] package:', {
            strong: <strong />,
          }),
        },
        {
          type: 'code',
          tabs: [
            {
              language: 'shell',
              label: 'Package Manager',
              code: getInstallSnippetPackageManager(params),
            },
            {
              language: 'shell',
              label: '.NET Core CLI',
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
      content: [
        {
          type: 'text',
          text: tct(
            'Add Sentry to [code:Program.cs] by calling [code:UseSentry] on the web host builder:',
            {code: <code />}
          ),
        },
        {
          type: 'code',
          tabs: [
            {
              label: 'WebApplication',
              language: 'csharp',
              code: getConfigureWebApplicationSnippet(params),
            },
            {
              label: 'IHostBuilder',
              language: 'csharp',
              code: getConfigureHostBuilderSnippet(params),
            },
          ],
        },
      ],
    },
  ],
  verify: params => [
    {
      type: StepType.VERIFY,
      content: [
        {
          type: 'text',
          text: t('To verify your set up, you can capture a message with the SDK:'),
        },
        {
          type: 'code',
          language: 'csharp',
          code: 'SentrySdk.CaptureMessage("Hello Sentry");',
        },
        {
          type: 'text',
          text: tct(
            "If you don't want to depend on the static class, the SDK also registers [code:IHub] in the dependency injection container. Take it as a parameter of a minimal API endpoint or of a controller's constructor, and call [code:CaptureMessage] on it instead.",
            {
              code: <code />,
            }
          ),
        },
        logsVerify(params),
        metricsVerify(params),
      ],
    },
    ...(params.isPerformanceSelected
      ? ([
          {
            title: t('Tracing'),
            content: [
              {
                type: 'text',
                text: tct(
                  '[code:UseSentry] registers the Sentry middleware, and setting [code:TracesSampleRate] turns on transactions, so the performance of your endpoints is measured without any further setup.',
                  {
                    code: <code />,
                  }
                ),
              },
              {
                type: 'text',
                text: tct(
                  'To add additional spans to the transaction of a request, take [code:IHub] as a dependency and use the API:',
                  {
                    code: <code />,
                  }
                ),
              },
              {
                type: 'code',
                tabs: [
                  {
                    label: 'Minimal API',
                    language: 'csharp',
                    code: getPerformanceSpansMinimalApiSnippet(),
                  },
                  {
                    label: 'MVC Controller',
                    language: 'csharp',
                    code: getPerformanceSpansControllerSnippet(),
                  },
                ],
              },
            ],
          },
        ] satisfies OnboardingStep[])
      : []),
    {
      title: t('Samples'),
      content: [
        {
          type: 'text',
          text: t(
            'See the following examples that demonstrate how to integrate Sentry with various frameworks.'
          ),
        },
        {
          type: 'list',
          items: [
            tct(
              '[link:Multiple samples in the [code:dotnet] SDK repository] [strong:(C#)]',
              {
                link: (
                  <ExternalLink href="https://github.com/getsentry/sentry-dotnet/tree/main/samples" />
                ),
                code: <code />,
                strong: <strong />,
              }
            ),
          ],
        },
      ],
    },
  ],
};
