import {ExternalLink} from 'sentry/components/core/link';
import type {
  Docs,
  DocsParams,
  OnboardingConfig,
} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {StepType} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {
  getCrashReportGenericInstallSteps,
  getCrashReportModalConfigDescription,
  getCrashReportModalIntroduction,
} from 'sentry/components/onboarding/gettingStartedDoc/utils/feedbackOnboarding';
import {csharpFeedbackOnboarding} from 'sentry/gettingStartedDocs/dotnet/dotnet';
import {t, tct} from 'sentry/locale';
import {getPackageVersion} from 'sentry/utils/gettingStartedDocs/getPackageVersion';

type Params = DocsParams;

const getInstallSnippetPackageManager = (params: Params) => `
Install-Package Sentry -Version ${getPackageVersion(params, 'sentry.dotnet', '3.34.0')}`;

const getInstallSnippetCoreCli = (params: Params) => `
dotnet add package Sentry -v ${getPackageVersion(params, 'sentry.dotnet', '3.34.0')}`;

const getConfigureSnippet = (params: Params) => `
using System.Windows;
using Sentry.Protocol;
using Sentry;

sealed partial class App : Application
{
    protected override void OnLaunched(LaunchActivatedEventArgs e)
    {
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
            }
        });
        Current.UnhandledException += UnhandledExceptionHandler;
    }

    [HandleProcessCorruptedStateExceptions, SecurityCritical]
    internal void ExceptionHandler(object sender, Windows.UI.Xaml.UnhandledExceptionEventArgs e)
    {
        // We need to hold the reference, because the Exception property is cleared when accessed.
        var exception = e.Exception;
        if (exception != null)
        {
            // Tells Sentry this was an Unhandled Exception
            exception.Data[Mechanism.HandledKey] = false;
            exception.Data[Mechanism.MechanismKey] = "Application.UnhandledException";
            SentrySdk.CaptureException(exception);
            // Make sure the event is flushed to disk or to Sentry
            SentrySdk.FlushAsync(TimeSpan.FromSeconds(3)).Wait();
        }
    }
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
  verify: () => [
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
            "Once you've verified the package is initialized properly and sent a test event, consider visiting our [link:complete UWP docs].",
            {
              link: (
                <ExternalLink href="https://docs.sentry.io/platforms/dotnet/guides/uwp/" />
              ),
            }
          ),
        },
      ],
    },
    {
      title: t('Samples'),
      content: [
        {
          type: 'text',
          text: tct(
            'You can find an example UWP app with Sentry integrated [link:on this GitHub repository].',
            {
              link: (
                <ExternalLink href="https://github.com/getsentry/examples/tree/master/dotnet/UwpCSharp" />
              ),
            }
          ),
        },
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
        link: 'https://docs.sentry.io/platforms/dotnet/guides/uwp/user-feedback/configuration/#crash-report-modal',
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
