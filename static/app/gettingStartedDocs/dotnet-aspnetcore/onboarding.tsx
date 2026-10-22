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
  '6.12.1'
)}`;

const getInstallSnippetCoreCli = (params: DocsParams) => `
dotnet add package Sentry.AspNetCore -v ${getPackageVersion(
  params,
  'sentry.dotnet.aspnetcore',
  '6.12.1'
)}`;

const getConfigureSnippet = (params: DocsParams) => `
var builder = WebApplication.CreateBuilder(args);

// Add the following lines:
builder.WebHost.UseSentry(o =>
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
      params.isLogsSelected
        ? `
    // Enable logs to be sent to Sentry
    o.EnableLogs = true;`
        : ''
    }
});

var app = builder.Build();`;

const getVerifySnippet = () => `
var app = builder.Build();

SentrySdk.CaptureMessage("Hello Sentry");

app.Run();`;

const getPerformanceSpansSnippet = () => `
app.MapGet("/person/{id}", (string id, IHub hub) =>
{
    var childSpan = hub.GetSpan()?.StartChild("additional-work");
    try
    {
        // Do the work that gets measured.

        childSpan?.Finish(SpanStatus.Ok);
        return Results.Ok(id);
    }
    catch (Exception e)
    {
        childSpan?.Finish(e);
        throw;
    }
});`;

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
            'Add Sentry to [code:Program.cs] by calling [code:UseSentry] on [code:builder.WebHost]:',
            {code: <code />}
          ),
        },
        {
          type: 'code',
          language: 'csharp',
          code: getConfigureSnippet(params),
        },
        {
          type: 'text',
          text: tct(
            'Keep [code:var app = builder.Build();] on its own line. If you chain [code:.Build()] onto [code:UseSentry(...)], calls like [code:app.MapGet(...)] will not compile.',
            {code: <code />}
          ),
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
          text: tct(
            'To verify your setup, capture a message after [code:builder.Build()] and before [code:app.Run()], which blocks until the app stops:',
            {code: <code />}
          ),
        },
        {
          type: 'code',
          language: 'csharp',
          code: getVerifySnippet(),
        },
        {
          type: 'text',
          text: tct(
            'The SDK also registers [code:IHub] in the dependency injection container. Take it as a dependency instead of calling the static [code:SentrySdk] class, which [link:makes your code easier to test].',
            {
              code: <code />,
              link: (
                <ExternalLink href="https://docs.sentry.io/platforms/dotnet/guides/aspnetcore/unit-testing/" />
              ),
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
                  'With [code:TracesSampleRate] set, Sentry traces every request automatically. To measure a specific part of a request, add a span inside your endpoint:',
                  {
                    code: <code />,
                  }
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
          ],
        },
      ],
    },
  ],
};
