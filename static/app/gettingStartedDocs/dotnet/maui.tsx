import {Fragment} from 'react';
import styled from '@emotion/styled';

import {Alert} from 'sentry/components/alert';
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
Install-Package Sentry.Maui -Version ${getPackageVersion(
  params,
  'sentry.dotnet.maui',
  params.isProfilingSelected ? '4.3.0' : '3.34.0'
)}`;

const getInstallSnippetCoreCli = (params: Params) => `
dotnet add package Sentry.Maui -v ${getPackageVersion(
  params,
  'sentry.dotnet.maui',
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

enum DotNetPlatform {
  WINDOWS = 0,
  IOS_MACCATALYST = 1,
}

const getConfigureSnippet = (params: Params, platform?: DotNetPlatform) => `
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
      }${
        params.isProfilingSelected
          ? `

      // Sample rate for profiling, applied on top of othe TracesSampleRate,
      // e.g. 0.2 means we want to profile 20 % of the captured transactions.
      // We recommend adjusting this value in production.
      options.ProfilesSampleRate = 1.0;${
        platform !== DotNetPlatform.IOS_MACCATALYST
          ? `

      // Requires NuGet package: Sentry.Profiling
      // Note: By default, the profiler is initialized asynchronously. This can
      // be tuned by passing a desired initialization timeout to the constructor.
      options.AddIntegration(new ProfilingIntegration(
          // During startup, wait up to 500ms to profile the app startup code.
          // This could make launching the app a bit slower so comment it out if you
          // prefer profiling to start asynchronously
          TimeSpan.FromMilliseconds(500)
      ));`
          : ''
      }`
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
                description: tct(
                  'Additionally, for all platforms except iOS/Mac Catalyst, you need to add a dependency on the [sentryProfilingPackage:Sentry.Profiling] NuGet package.',
                  {
                    sentryProfilingPackage: <code />,
                  }
                ),
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
              {
                description: (
                  <AlertWithoutMarginBottom type="info">
                    {t(
                      'Profiling for .NET Framework and .NET on Android are not supported.'
                    )}
                  </AlertWithoutMarginBottom>
                ),
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
        'Then add Sentry to [code:MauiProgram.cs] through the [code:MauiAppBuilder]:',
        {
          code: <code />,
        }
      ),
      configurations: [
        params.isProfilingSelected
          ? {
              code: [
                {
                  language: 'csharp',
                  label: 'Windows',
                  value: 'Windows',
                  code: getConfigureSnippet(params, DotNetPlatform.WINDOWS),
                },
                {
                  language: 'csharp',
                  label: 'iOS/Mac Catalyst',
                  value: 'ios/macCatalyst',
                  code: getConfigureSnippet(params, DotNetPlatform.IOS_MACCATALYST),
                },
              ],
            }
          : {
              language: 'csharp',
              code: getConfigureSnippet(params),
            },
      ],
    },
  ],
  verify: params => [
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
    ...(params.isPerformanceSelected
      ? [
          {
            title: t('Tracing'),
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
                        <ExternalLink href="https://docs.sentry.io/platforms/dotnet/guides/maui/tracing/instrumentation/automatic-instrumentation/" />
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
                            <ExternalLink href="https://docs.sentry.io/platforms/dotnet/guides/maui/tracing/instrumentation/custom-instrumentation/" />
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
        ]
      : []),
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

const crashReportOnboarding: OnboardingConfig = {
  introduction: () => getCrashReportModalIntroduction(),
  install: (params: Params) => getCrashReportGenericInstallStep(params),
  configure: () => [
    {
      type: StepType.CONFIGURE,
      description: getCrashReportModalConfigDescription({
        link: 'https://docs.sentry.io/platforms/dotnet/guides/maui/user-feedback/configuration/#crash-report-modal',
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

const AlertWithoutMarginBottom = styled(Alert)`
  margin-bottom: 0;
`;
