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
Install-Package Sentry -Version ${getPackageVersion(params, 'sentry.dotnet', '3.34.0')}`;

const getInstallSnippetCoreCli = (params: DocsParams) => `
dotnet add package Sentry -v ${getPackageVersion(params, 'sentry.dotnet', '3.34.0')}`;

const getConfigureSnippet = (params: DocsParams) => `
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
