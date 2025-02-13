import {Fragment} from 'react';

import {Alert} from 'sentry/components/alert';
import ExternalLink from 'sentry/components/links/externalLink';
import List from 'sentry/components/list';
import ListItem from 'sentry/components/list/listItem';
import altCrashReportCallout from 'sentry/components/onboarding/gettingStartedDoc/feedback/altCrashReportCallout';
import {StepType} from 'sentry/components/onboarding/gettingStartedDoc/step';
import type {
  Docs,
  DocsParams,
  OnboardingConfig,
} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {
  getCrashReportApiIntroduction,
  getCrashReportGenericInstallStep,
  getCrashReportInstallDescription,
  getCrashReportModalConfigDescription,
  getCrashReportModalIntroduction,
} from 'sentry/components/onboarding/gettingStartedDoc/utils/feedbackOnboarding';
import {t, tct} from 'sentry/locale';
import {getPackageVersion} from 'sentry/utils/gettingStartedDocs/getPackageVersion';

type Params = DocsParams;

const getInstallSnippetPackageManager = (params: Params) => `
Install-Package Sentry -Version ${getPackageVersion(
  params,
  'sentry.dotnet',
  params.isProfilingSelected ? '4.3.0' : '3.34.0'
)}`;

const getInstallSnippetCoreCli = (params: Params) => `
dotnet add package Sentry -v ${getPackageVersion(
  params,
  'sentry.dotnet',
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
using Sentry;

SentrySdk.Init(options =>
{
    // A Sentry Data Source Name (DSN) is required.
    // See https://docs.sentry.io/product/sentry-basics/dsn-explainer/
    // You can set it in the SENTRY_DSN environment variable, or you can set it in code here.
    options.Dsn = "${params.dsn.public}";

    // When debug is enabled, the Sentry client will emit detailed debugging information to the console.
    // This might be helpful, or might interfere with the normal operation of your application.
    // We enable it here for demonstration purposes when first trying Sentry.
    // You shouldn't do this in your applications unless you're troubleshooting issues with Sentry.
    options.Debug = true;

    // This option is recommended. It enables Sentry's "Release Health" feature.
    options.AutoSessionTracking = true;${
      params.isPerformanceSelected
        ? `

    // Set TracesSampleRate to 1.0 to capture 100%
    // of transactions for tracing.
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
});`;

const getPerformanceMonitoringSnippet = () => `
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
  introduction: () =>
    tct(
      'Sentry for .NET is a collection of NuGet packages provided by Sentry; it supports .NET Framework 4.6.1 and .NET Core 2.0 and above. At its core, Sentry for .NET provides a raw client for sending events to Sentry. If you use a framework such as [strong:ASP.NET, WinForms, WPF, MAUI, Xamarin, Serilog], or similar, we recommend visiting our [link:Sentry .NET] documentation for installation instructions.',
      {
        strong: <strong />,
        link: <ExternalLink href="https://docs.sentry.io/platforms/dotnet/" />,
      }
    ),
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
                  <Alert margin={false} type="info">
                    {t(
                      'Profiling for .NET Framework and .NET on Android are not supported.'
                    )}
                  </Alert>
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
        'Initialize the SDK as early as possible. For example, call [code:SentrySdk.Init] in your [code:Program.cs] file:',
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
                  label: 'Windows/Linux/macOS',
                  value: 'windows/linux/macos',
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
  verify: (params: Params) => [
    {
      type: StepType.VERIFY,
      description: t('Verify Sentry is correctly configured by sending a message:'),
      configurations: [
        {
          language: 'csharp',
          code: 'SentrySdk.CaptureMessage("Something went wrong");',
        },
      ],
    },
    ...(params.isPerformanceSelected
      ? [
          {
            title: t('Tracing'),
            description: t(
              'You can measure the performance of your code by capturing transactions and spans.'
            ),
            configurations: [
              {
                language: 'csharp',
                code: getPerformanceMonitoringSnippet(),
              },
            ],
            additionalInfo: tct(
              'Check out [link:the documentation] to learn more about the API and automatic instrumentations.',
              {
                link: (
                  <ExternalLink href="https://docs.sentry.io/platforms/dotnet/tracing/instrumentation/" />
                ),
              }
            ),
          },
        ]
      : []),
    {
      title: t('Samples'),
      description: (
        <Fragment>
          <p>
            {tct(
              'You can find an example ASP.NET MVC 5 app with Sentry integrated [link:on this GitHub repository].',
              {
                link: (
                  <ExternalLink href="https://github.com/getsentry/examples/tree/master/dotnet/AspNetMvc5Ef6" />
                ),
              }
            )}
          </p>
          {t(
            'In addition, these examples demonstrate how to integrate Sentry with various frameworks:'
          )}
        </Fragment>
      ),
      configurations: [
        {
          description: (
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
            </List>
          ),
        },
      ],
    },
  ],
};

export const csharpFeedbackOnboarding: OnboardingConfig = {
  introduction: () => getCrashReportApiIntroduction(),
  install: () => [
    {
      type: StepType.INSTALL,
      description: getCrashReportInstallDescription(),
      configurations: [
        {
          code: [
            {
              label: 'C#',
              value: 'csharp',
              language: 'csharp',
              code: `using Sentry;

var eventId = SentrySdk.CaptureMessage("An event that will receive user feedback.");

SentrySdk.CaptureUserFeedback(eventId, "user@example.com", "It broke.", "The User");`,
            },
            {
              label: 'F#',
              value: 'fsharp',
              language: 'fsharp',
              code: `open Sentry

let eventId = SentrySdk.CaptureMessage("An event that will receive user feedback.")

SentrySdk.CaptureUserFeedback(eventId, "user@example.com", "It broke.", "The User")`,
            },
          ],
        },
      ],
      additionalInfo: altCrashReportCallout(),
    },
  ],
  configure: () => [],
  verify: () => [],
  nextSteps: () => [],
};

const crashReportOnboarding: OnboardingConfig = {
  introduction: () => getCrashReportModalIntroduction(),
  install: (params: Params) => getCrashReportGenericInstallStep(params),
  configure: () => [
    {
      type: StepType.CONFIGURE,
      description: getCrashReportModalConfigDescription({
        link: 'https://docs.sentry.io/platforms/dotnet/user-feedback/configuration/#crash-report-modal',
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
