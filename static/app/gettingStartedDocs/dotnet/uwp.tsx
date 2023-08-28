import {Fragment} from 'react';
import styled from '@emotion/styled';

import {Alert} from 'sentry/components/alert';
import ExternalLink from 'sentry/components/links/externalLink';
import List from 'sentry/components/list';
import ListItem from 'sentry/components/list/listItem';
import {Layout, LayoutProps} from 'sentry/components/onboarding/gettingStartedDoc/layout';
import {ModuleProps} from 'sentry/components/onboarding/gettingStartedDoc/sdkDocumentation';
import {StepType} from 'sentry/components/onboarding/gettingStartedDoc/step';
import {t, tct} from 'sentry/locale';

// Configuration Start
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
    additionalInfo: (
      <AlertWithoutMarginBottom type="info">
        {tct(
          '[strong:Using .NET Framework prior to 4.6.1?] Our legacy SDK supports .NET Framework as early as 3.5.',
          {strong: <strong />}
        )}
      </AlertWithoutMarginBottom>
    ),
  },
  {
    type: StepType.CONFIGURE,
    description: (
      <p>
        {tct(
          'Initialize the SDK as early as possible, like in the constructor of the [code:App]:',
          {
            code: <code />,
          }
        )}
      </p>
    ),
    configurations: [
      {
        language: 'csharp',
        code: `
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
            o.Dsn = "${dsn}";
            // When configuring for the first time, to see what the SDK is doing:
            o.Debug = true;
            // Set TracesSampleRate to 1.0 to capture 100% of transactions for performance monitoring.
            // We recommend adjusting this value in production.
            o.TracesSampleRate = 1.0;
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
}
        `,
      },
    ],
  },
  {
    type: StepType.VERIFY,
    description: t('To verify your set up, you can capture a message with the SDK:'),
    configurations: [
      {
        language: 'csharp',
        code: 'SentrySdk.CaptureMessage("Hello Sentry");',
      },
    ],
    additionalInfo: (
      <p>
        {tct(
          "If you don't want to depend on the static class, the SDK registers a client in the DI container. In this case, you can [link:take [code:IHub] as a dependency].",
          {
            code: <code />,
            link: (
              <ExternalLink href="https://docs.sentry.io/platforms/dotnet/guides/aspnetcore/unit-testing/" />
            ),
          }
        )}
      </p>
    ),
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
    title: t('Documentation'),
    description: (
      <p>
        {tct(
          "Once you've verified the package is initialized properly and sent a test event, consider visiting our [link:complete UWP docs].",
          {
            link: (
              <ExternalLink href="https://docs.sentry.io/platforms/dotnet/guides/uwp/" />
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
            'You can find an example UWP app with Sentry integrated [link:on this GitHub repository].',
            {
              link: (
                <ExternalLink href="https://github.com/getsentry/examples/tree/master/dotnet/UwpCSharp" />
              ),
            }
          )}
        </p>
        {t(
          'See the following examples that demonstrate how to integrate Sentry with various frameworks.'
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

export function GettingStartedWithUwp({
  dsn,
  sourcePackageRegistries,
  ...props
}: ModuleProps) {
  return <Layout steps={steps({dsn, sourcePackageRegistries})} {...props} />;
}

export default GettingStartedWithUwp;

const AlertWithoutMarginBottom = styled(Alert)`
  margin-bottom: 0;
`;
