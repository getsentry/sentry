import {ExternalLink} from 'sentry/components/core/link';
import type {
  DocsParams,
  OnboardingConfig,
  OnboardingStep,
} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {StepType} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {t, tct} from 'sentry/locale';
import {getPackageVersion} from 'sentry/utils/gettingStartedDocs/getPackageVersion';

const getInstallSnippetPackageManager = (params: DocsParams) => `
Install-Package Sentry.AspNetCore -Version ${getPackageVersion(
  params,
  'sentry.dotnet.aspnetcore',
  '4.3.0'
)}`;

const getInstallSnippetCoreCli = (params: DocsParams) => `
dotnet add package Sentry.AspNetCore -v ${getPackageVersion(
  params,
  'sentry.dotnet.aspnetcore',
  '4.3.0'
)}`;

const getConfigureSnippet = (params: DocsParams) => `
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
            'Add Sentry to [code:Program.cs] through the [code:WebHostBuilder]:',
            {code: <code />}
          ),
        },
        {
          type: 'code',
          language: 'csharp',
          code: getConfigureSnippet(params),
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
            "If you don't want to depend on the static class, the SDK registers a client in the DI container. In this case, you can [link:take [code:IHub] as a dependency].",
            {
              code: <code />,
              link: (
                <ExternalLink href="https://docs.sentry.io/platforms/dotnet/guides/aspnetcore/unit-testing/" />
              ),
            }
          ),
        },
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
                  'You can measure the performance of your endpoints by adding a middleware to [code:Startup.cs]:',
                  {
                    code: <code />,
                  }
                ),
              },
              {
                type: 'text',
                text: t(
                  "You'll be able to monitor the performance of your actions automatically. To add additional spans to it, you can use the API:"
                ),
              },
              {
                type: 'code',
                language: 'csharp',
                code: getPerformanceSpansSnippet(),
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
            tct('[link:Basic F# sample] [strong:(F#)]', {
              link: <ExternalLink href="https://github.com/sentry-demos/fsharp" />,
              strong: <strong />,
            }),
            tct('[link:Giraffe F# sample] [strong:(F#)]', {
              link: <ExternalLink href="https://github.com/sentry-demos/giraffe" />,
              strong: <strong />,
            }),
          ],
        },
      ],
    },
  ],
};
