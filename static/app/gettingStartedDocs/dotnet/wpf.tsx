import {ExternalLink} from 'sentry/components/core/link';
import type {
  Docs,
  DocsParams,
  OnboardingConfig,
  OnboardingStep,
} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {StepType} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {
  getCrashReportGenericInstallSteps,
  getCrashReportModalConfigDescription,
  getCrashReportModalIntroduction,
} from 'sentry/components/onboarding/gettingStartedDoc/utils/feedbackOnboarding';
import {csharpFeedbackOnboarding} from 'sentry/gettingStartedDocs/dotnet/dotnet';
import {t, tct} from 'sentry/locale';
import {getDotnetProfilingOnboarding} from 'sentry/utils/gettingStartedDocs/dotnet';
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

const getConfigureSnippet = (params: Params) => `
using System.Windows.Threading;
using System.Windows;
using Sentry;

public partial class App : Application
{
    public App()
    {
        DispatcherUnhandledException += App_DispatcherUnhandledException;
        SentrySdk.Init(o =>
        {
            // Tells which project in Sentry to send events to:
            o.Dsn = "${params.dsn.public}";
            // When configuring for the first time, to see what the SDK is doing:
            o.Debug = true;${
              params.isPerformanceSelected
                ? `
            // Set TracesSampleRate to 1.0 to capture 100% of transactions for tracing.
            // We recommend adjusting this value in production.
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
                // prefer profiling to start asynchronously
                TimeSpan.FromMilliseconds(500)
            ));`
                : ''
            }
        });
    }

    void App_DispatcherUnhandledException(object sender, DispatcherUnhandledExceptionEventArgs e)
    {
        SentrySdk.CaptureException(e.Exception);

        // If you want to avoid the application from crashing:
        e.Handled = true;
    }`;

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
        {
          type: 'conditional',
          condition: params.isProfilingSelected,
          content: [
            {
              type: 'text',
              text: tct(
                'Additionally, you need to add a dependency on the [sentryProfilingPackage:Sentry.Profiling] NuGet package.',
                {
                  sentryProfilingPackage: <code />,
                }
              ),
            },
            {
              type: 'code',
              tabs: [
                {
                  label: 'Package Manager',
                  language: 'shell',
                  code: getInstallProfilingSnippetPackageManager(params),
                },
                {
                  label: '.NET Core CLI',
                  language: 'shell',
                  code: getInstallProfilingSnippetCoreCli(params),
                },
              ],
            },
            {
              type: 'alert',
              alertType: 'info',
              showIcon: false,
              text: t('Profiling for .NET Framework is not supported.'),
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
            'Initialize the SDK as early as possible, like in the constructor of the [code:App]:',
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
          text: t('To verify your set up, you can capture a message with the SDK:'),
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
                  'You can measure the performance of your code by capturing transactions and spans.'
                ),
              },
              {
                type: 'code',
                language: 'csharp',
                code: getPerformanceInstrumentationSnippet(),
              },
              {
                type: 'text',
                text: tct(
                  'Check out [link:the documentation] to learn more about the API and automatic instrumentations.',
                  {
                    link: (
                      <ExternalLink href="https://docs.sentry.io/platforms/dotnet/tracing/instrumentation/" />
                    ),
                  }
                ),
              },
            ],
          },
          {
            title: t('Documentation'),
            content: [
              {
                type: 'text',
                text: tct(
                  "Once you've verified the package is initialized properly and sent a test event, consider visiting our [link:complete WPF docs].",
                  {
                    link: (
                      <ExternalLink href="https://docs.sentry.io/platforms/dotnet/guides/wpf/" />
                    ),
                  }
                ),
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
          ],
        },
      ],
    },
  ],
};

const crashReportOnboarding: OnboardingConfig = {
  introduction: () => getCrashReportModalIntroduction(),
  install: (params: Params) => getCrashReportGenericInstallSteps(params),
  configure: () => [
    {
      type: StepType.CONFIGURE,
      description: getCrashReportModalConfigDescription({
        link: 'https://docs.sentry.io/platforms/dotnet/guides/wpf/user-feedback/configuration/#crash-report-modal',
      }),
    },
  ],
  verify: () => [],
  nextSteps: () => [],
};

const profilingOnboarding = getDotnetProfilingOnboarding({
  getInstallSnippetPackageManager,
  getInstallSnippetCoreCli,
});

const docs: Docs = {
  onboarding,
  feedbackOnboardingCrashApi: csharpFeedbackOnboarding,
  crashReportOnboarding,
  profilingOnboarding,
};

export default docs;
