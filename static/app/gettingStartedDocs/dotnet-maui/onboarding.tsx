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
Install-Package Sentry.Maui -Version ${getPackageVersion(
  params,
  'sentry.dotnet.maui',
  '4.3.0'
)}`;

const getInstallSnippetCoreCli = (params: DocsParams) => `
dotnet add package Sentry.Maui -v ${getPackageVersion(
  params,
  'sentry.dotnet.maui',
  '4.3.0'
)}`;

const getConfigureSnippet = (params: DocsParams) => `
public static MauiApp CreateMauiApp()
{
  var builder = MauiApp.CreateBuilder();
  builder
    .UseMauiApp<App>()

    // Add this section anywhere on the builder:
    .UseSentry(options => {
      // The DSN is the only required setting.
      options.Dsn = "${params.dsn.public}";

      // Use debug mode if you want to see what the SDK is doing.
      // Debug messages are written to stdout with Console.Writeline,
      // and are viewable in your IDE's debug console or with 'adb logcat', etc.
      // This option is not recommended when deploying your application.
      options.Debug = true;${
        params.isPerformanceSelected
          ? `

      // Set TracesSampleRate to 1.0 to capture 100% of transactions for tracing.
      // We recommend adjusting this value in production.
      options.TracesSampleRate = 1.0;`
          : ''
      }

      // Other Sentry options can be set here.
  })

  // ... the remainder of your MAUI app setup

  return builder.Build();
}`;

const getPerformanceMessageHandlerSnippet = () => `
var httpHandler = new SentryHttpMessageHandler();
var httpClient = new HttpClient(httpHandler);`;

const getPerformanceInstrumentationSnippet = () => `
// Transaction can be started by providing, at minimum, the name and the operation
var transaction = SentrySdk.StartTransaction(
  "test-transaction-name",
  "test-transaction-operation"
);

// Transactions can have child spans (and those spans can have child spans as well)
var span = transaction.StartChild("test-child-operation");

// ...
// (Perform the operation represented by the span/transaction)
// ...

span.Finish(); // Mark the span as finished
transaction.Finish(); // Mark the transaction as finished and send it to Sentry`;

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
              label: 'Package Manager',
              language: 'shell',
              code: getInstallSnippetPackageManager(params),
            },
            {
              label: '.NET Core CLI',
              language: 'shell',
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
            'Then add Sentry to [code:MauiProgram.cs] through the [code:MauiAppBuilder]:',
            {
              code: <code />,
            }
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
          text: t(
            'To verify your set up, you can capture a message with the SDK, anywhere in your code after the application is built, such as in a page constructor or button click event handler:'
          ),
        },
        {
          type: 'code',
          language: 'csharp',
          code: 'SentrySdk.CaptureMessage("Hello Sentry");',
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
                text: t(
                  'We do not yet have automatic performance instrumentation for .NET MAUI. We will be adding that in a future release. However, if desired you can still manually instrument parts of your application.'
                ),
              },
              {
                type: 'text',
                text: tct(
                  'For some parts of your code, [automaticInstrumentationLink:automatic instrumentation] is available across all of our .NET SDKs, and can be used with MAUI as well.',
                  {
                    automaticInstrumentationLink: (
                      <ExternalLink href="https://docs.sentry.io/platforms/dotnet/guides/maui/tracing/instrumentation/automatic-instrumentation/" />
                    ),
                  }
                ),
              },
              {
                type: 'text',
                text: tct(
                  'If your app uses [code:HttpClient], you can instrument your HTTP calls by passing our HTTP message handler:',
                  {code: <code />}
                ),
              },
              {
                type: 'code',
                language: 'csharp',
                code: getPerformanceMessageHandlerSnippet(),
              },
              {
                type: 'text',
                text: t(
                  'If your app uses Entity Framework Core or SQL Client, we will automatically instrument that for you without any additional code.'
                ),
              },
              {
                type: 'text',
                text: tct(
                  'For other parts of your code, you can use [customInstrumentationLink:custom instrumentation], such as in the following example:',
                  {
                    customInstrumentationLink: (
                      <ExternalLink href="https://docs.sentry.io/platforms/dotnet/guides/maui/tracing/instrumentation/custom-instrumentation/" />
                    ),
                  }
                ),
              },
              {
                type: 'code',
                language: 'csharp',
                code: getPerformanceInstrumentationSnippet(),
              },
            ],
          },
        ] satisfies OnboardingStep[])
      : []),
    {
      title: t('Sample Application'),
      content: [
        {
          type: 'text',
          text: tct(
            'See the [mauiSampleLink:MAUI Sample in the [code:sentry-dotnet] repository].',
            {
              mauiSampleLink: (
                <ExternalLink href="https://github.com/getsentry/sentry-dotnet/tree/main/samples/Sentry.Samples.Maui" />
              ),
              code: <code />,
            }
          ),
        },
      ],
    },
  ],
};
