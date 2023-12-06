import {Fragment} from 'react';

import ExternalLink from 'sentry/components/links/externalLink';
import List from 'sentry/components/list';
import ListItem from 'sentry/components/list/listItem';
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
Install-Package Sentry -Version ${getPackageVersion(params, 'sentry.dotnet', '3.34.0')}`;

const getInstallSnippetCoreCli = (params: Params) => `
dotnet add package Sentry -v ${getPackageVersion(params, 'sentry.dotnet', '3.34.0')}`;

const getConfigureSnippet = (params: Params) => `
using Sentry;

SentrySdk.Init(options =>
{
    // A Sentry Data Source Name (DSN) is required.
    // See https://docs.sentry.io/product/sentry-basics/dsn-explainer/
    // You can set it in the SENTRY_DSN environment variable, or you can set it in code here.
    options.Dsn = "${params.dsn}";

    // When debug is enabled, the Sentry client will emit detailed debugging information to the console.
    // This might be helpful, or might interfere with the normal operation of your application.
    // We enable it here for demonstration purposes when first trying Sentry.
    // You shouldn't do this in your applications unless you're troubleshooting issues with Sentry.
    options.Debug = true;

    // This option is recommended. It enables Sentry's "Release Health" feature.
    options.AutoSessionTracking = true;

    // This option is recommended for client applications only. It ensures all threads use the same global scope.
    // If you're writing a background service of any kind, you should remove this.
    options.IsGlobalModeEnabled = true;

    // This option will enable Sentry's tracing features. You still need to start transactions and spans.
    options.EnableTracing = true;
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
      ],
    },
  ],
  configure: params => [
    {
      type: StepType.CONFIGURE,
      description: tct(
        'Initialize the SDK as early as possible. For example, call [sentrySdkCode:SentrySdk.Init] in your [programCode:Program.cs] file:',
        {
          sentrySdkCode: <code />,
          programCode: <code />,
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
      description: t('Verify Sentry is correctly configured by sending a message:'),
      configurations: [
        {
          language: 'csharp',
          code: 'SentrySdk.CaptureMessage("Something went wrong");',
        },
      ],
    },
    {
      title: t('Performance Monitoring'),
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
            <ExternalLink href="https://docs.sentry.io/platforms/dotnet/performance/instrumentation/" />
          ),
        }
      ),
    },
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

const docs: Docs = {
  onboarding,
};

export default docs;
