import {Fragment} from 'react';

import ExternalLink from 'sentry/components/links/externalLink';
import {StepType} from 'sentry/components/onboarding/gettingStartedDoc/step';
import type {
  Docs,
  DocsParams,
  OnboardingConfig,
} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {t, tct} from 'sentry/locale';
import {getPackageVersion} from 'sentry/utils/gettingStartedDocs/getPackageVersion';

type Params = DocsParams;

const getInstallSnippetPackageManager = (params: Params) => `
Install-Package Sentry.Maui -Version ${getPackageVersion(
  params,
  'sentry.dotnet.maui',
  '3.34.0'
)}`;

const getInstallSnippetCoreCli = (params: Params) => `
dotnet add package Sentry.Maui -v ${getPackageVersion(
  params,
  'sentry.dotnet.maui',
  '3.34.0'
)}`;

const getConfigureSnippet = (params: Params) => `
public static MauiApp CreateMauiApp()
{
  var builder = MauiApp.CreateBuilder();
  builder
    .UseMauiApp<App>()

    // Add this section anywhere on the builder:
    .UseSentry(options => {
      // The DSN is the only required setting.
      options.Dsn = "${params.dsn}";

      // Use debug mode if you want to see what the SDK is doing.
      // Debug messages are written to stdout with Console.Writeline,
      // and are viewable in your IDE's debug console or with 'adb logcat', etc.
      // This option is not recommended when deploying your application.
      options.Debug = true;

      // Set TracesSampleRate to 1.0 to capture 100% of transactions for performance monitoring.
      // We recommend adjusting this value in production.
      options.TracesSampleRate = 1.0;

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
        'Then add Sentry to [mauiProgram:MauiProgram.cs] through the [mauiAppBuilderCode:MauiAppBuilder]:',
        {
          mauiAppBuilderCode: <code />,
          mauiProgram: <code />,
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
      description: t(
        'To verify your set up, you can capture a message with the SDK, anywhere in your code after the application is built, such as in a page constructor or button click event handler:'
      ),
      configurations: [
        {
          language: 'csharp',
          code: 'SentrySdk.CaptureMessage("Hello Sentry");',
        },
      ],
    },
    {
      title: t('Performance Monitoring'),
      description: (
        <Fragment>
          {t(
            'We do not yet have automatic performance instrumentation for .NET MAUI. We will be adding that in a future release. However, if desired you can still manually instrument parts of your application.'
          )}
          <p>
            {tct(
              'For some parts of your code, [automaticInstrumentationLink:automatic instrumentation] is available across all of our .NET SDKs, and can be used with MAUI as well:',
              {
                automaticInstrumentationLink: (
                  <ExternalLink href="https://docs.sentry.io/platforms/dotnet/guides/maui/performance/instrumentation/automatic-instrumentation/" />
                ),
              }
            )}
          </p>
        </Fragment>
      ),
      configurations: [
        {
          description: tct(
            'If your app uses [code:HttpClient], you can instrument your HTTP calls by passing our HTTP message handler:',
            {code: <code />}
          ),
          language: 'csharp',
          code: getPerformanceMessageHandlerSnippet(),
        },
        {
          description: (
            <Fragment>
              {t(
                'If your app uses Entity Framework Core or SQL Client, we will automatically instrument that for you without any additional code.'
              )}
              <p>
                {tct(
                  'For other parts of your code, you can use [customInstrumentationLink:custom instrumentation], such as in the following example:',
                  {
                    customInstrumentationLink: (
                      <ExternalLink href="https://docs.sentry.io/platforms/dotnet/guides/maui/performance/instrumentation/custom-instrumentation/" />
                    ),
                  }
                )}
              </p>
            </Fragment>
          ),
          language: 'csharp',
          code: getPerformanceInstrumentationSnippet(),
        },
      ],
    },
    {
      title: t('Sample Application'),
      description: tct(
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
};

const docs: Docs = {
  onboarding,
};

export default docs;
