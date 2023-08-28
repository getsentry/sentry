import {Fragment} from 'react';

import ExternalLink from 'sentry/components/links/externalLink';
import List from 'sentry/components/list';
import ListItem from 'sentry/components/list/listItem';
import {Layout, LayoutProps} from 'sentry/components/onboarding/gettingStartedDoc/layout';
import {ModuleProps} from 'sentry/components/onboarding/gettingStartedDoc/sdkDocumentation';
import {StepType} from 'sentry/components/onboarding/gettingStartedDoc/step';
import {t, tct} from 'sentry/locale';

// Configuration Start
const introduction = (
  <p>
    {tct(
      'Sentry for .NET is a collection of NuGet packages provided by Sentry; it supports .NET Framework 4.6.1 and .NET Core 2.0 and above. At its core, Sentry for .NET provides a raw client for sending events to Sentry. If you use a framework such as [strong:ASP.NET, WinForms, WPF, MAUI, Xamarin, Serilog], or similar, we recommend visiting our [link:Sentry .NET] documentation for installation instructions.',
      {
        strong: <strong />,
        link: <ExternalLink href="https://docs.sentry.io/platforms/dotnet/" />,
      }
    )}
  </p>
);
export const steps = ({
  dsn,
  sourcePackageRegistries,
}: Partial<
  Pick<ModuleProps, 'dsn' | 'sourcePackageRegistries'>
> = {}): LayoutProps['steps'] => [
  {
    type: StepType.INSTALL,
    description: (
      <p>
        {tct('Install the [strong:NuGet] package:', {
          strong: <strong />,
        })}
      </p>
    ),
    configurations: [
      {
        language: 'shell',
        partialLoading: sourcePackageRegistries?.isLoading,
        code: `
# Using Package Manager
Install-Package Sentry -Version ${
          sourcePackageRegistries?.isLoading
            ? t('\u2026loading')
            : sourcePackageRegistries?.data?.['sentry.dotnet']?.version ?? '3.34.0'
        }

# Or using .NET Core CLI
dotnet add package Sentry -v ${
          sourcePackageRegistries?.isLoading
            ? t('\u2026loading')
            : sourcePackageRegistries?.data?.['sentry.dotnet']?.version ?? '3.34.0'
        }
        `,
      },
    ],
  },
  {
    type: StepType.CONFIGURE,
    description: (
      <p>
        {tct(
          'Initialize the SDK as early as possible. For example, call [sentrySdkCode:SentrySdk.Init] in your [programCode:Program.cs] file:',
          {
            sentrySdkCode: <code />,
            programCode: <code />,
          }
        )}
      </p>
    ),
    configurations: [
      {
        language: 'csharp',
        code: `
using Sentry;

SentrySdk.Init(options =>
{
    // A Sentry Data Source Name (DSN) is required.
    // See https://docs.sentry.io/product/sentry-basics/dsn-explainer/
    // You can set it in the SENTRY_DSN environment variable, or you can set it in code here.
    options.Dsn = "${dsn}";

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
});
        `,
      },
    ],
  },
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
        code: `
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
transaction.Finish(); // Mark the transaction as finished and send it to Sentry
        `,
      },
    ],
    additionalInfo: (
      <p>
        {tct(
          'Check out [link:the documentation] to learn more about the API and automatic instrumentations.',
          {
            link: (
              <ExternalLink href="https://docs.sentry.io/platforms/dotnet/performance/instrumentation/" />
            ),
          }
        )}
      </p>
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
      </Fragment>
    ),
  },
];
// Configuration End

export function GettingStartedWithDotnet({
  dsn,
  sourcePackageRegistries,
  ...props
}: ModuleProps) {
  return (
    <Layout
      steps={steps({dsn, sourcePackageRegistries})}
      introduction={introduction}
      {...props}
    />
  );
}

export default GettingStartedWithDotnet;
