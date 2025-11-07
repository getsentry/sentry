import {ExternalLink} from 'sentry/components/core/link';
import type {
  DocsParams,
  OnboardingConfig,
  OnboardingStep,
} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {StepType} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {t, tct} from 'sentry/locale';
import {getPackageVersion} from 'sentry/utils/gettingStartedDocs/getPackageVersion';

import {getInstallSnippetCoreCli, getInstallSnippetPackageManager} from './utils';

const getInstallProfilingSnippetPackageManager = (params: DocsParams) => `
Install-Package Sentry.Profiling -Version ${getPackageVersion(
  params,
  'sentry.dotnet.profiling',
  '4.3.0'
)}`;

const getInstallProfilingSnippetCoreCli = (params: DocsParams) => `
dotnet add package Sentry.Profiling -v ${getPackageVersion(
  params,
  'sentry.dotnet.profiling',
  '4.3.0'
)}`;

enum DotNetPlatform {
  WINDOWS = 0,
  IOS_MACCATALYST = 1,
}

const getConfigureSnippet = (params: DocsParams, platform?: DotNetPlatform) => `
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
      platform === DotNetPlatform.IOS_MACCATALYST
        ? ''
        : `
    // Requires NuGet package: Sentry.Profiling
    // Note: By default, the profiler is initialized asynchronously. This can
    // be tuned by passing a desired initialization timeout to the constructor.
    options.AddIntegration(new ProfilingIntegration(
        // During startup, wait up to 500ms to profile the app startup code.
        // This could make launching the app a bit slower so comment it out if you
        // prefer profiling to start asynchronously
        TimeSpan.FromMilliseconds(500)
    ));`
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

export const onboarding: OnboardingConfig = {
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
                'Additionally, for all platforms except iOS/Mac Catalyst, you need to add a dependency on the [sentryProfilingPackage:Sentry.Profiling] NuGet package.',
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
              text: t(
                'Profiling for .NET Framework and .NET on Android are not supported.'
              ),
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
            'Initialize the SDK as early as possible. For example, call [code:SentrySdk.Init] in your [code:Program.cs] file:',
            {
              code: <code />,
            }
          ),
        },
        params.isProfilingSelected
          ? {
              type: 'code',
              tabs: [
                {
                  label: 'Windows/Linux/macOS',
                  language: 'csharp',
                  code: getConfigureSnippet(params, DotNetPlatform.WINDOWS),
                },
                {
                  label: 'iOS/Mac Catalyst',
                  language: 'csharp',
                  code: getConfigureSnippet(params, DotNetPlatform.IOS_MACCATALYST),
                },
              ],
            }
          : {
              type: 'code',
              language: 'csharp',
              code: getConfigureSnippet(params),
            },
      ],
    },
  ],
  verify: (params: DocsParams) => [
    {
      type: StepType.VERIFY,
      content: [
        {
          type: 'text',
          text: t('Verify Sentry is correctly configured by sending a message:'),
        },
        {
          type: 'code',
          language: 'csharp',
          code: 'SentrySdk.CaptureMessage("Something went wrong");',
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
                code: getPerformanceMonitoringSnippet(),
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
        ] satisfies OnboardingStep[])
      : []),
    {
      title: t('Samples'),
      content: [
        {
          type: 'text',
          text: [
            tct(
              'You can find an example ASP.NET MVC 5 app with Sentry integrated [link:on this GitHub repository].',
              {
                link: (
                  <ExternalLink href="https://github.com/getsentry/examples/tree/master/dotnet/AspNetMvc5Ef6" />
                ),
              }
            ),
            t(
              'In addition, these examples demonstrate how to integrate Sentry with various frameworks:'
            ),
          ],
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
