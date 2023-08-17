import {Fragment} from 'react';

import ExternalLink from 'sentry/components/links/externalLink';
import {Layout, LayoutProps} from 'sentry/components/onboarding/gettingStartedDoc/layout';
import {ModuleProps} from 'sentry/components/onboarding/gettingStartedDoc/sdkDocumentation';
import {StepType} from 'sentry/components/onboarding/gettingStartedDoc/step';
import {t, tct} from 'sentry/locale';

// Configuration Start
export const steps = ({
  dsn,
}: {
  dsn?: string;
} = {}): LayoutProps['steps'] => [
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
        code: `
# For Xamarin.Forms
Install-Package Sentry.Xamarin.Forms -Version 1.5.2

# If you are not using Xamarin.Forms, but only Xamarin:
Install-Package Sentry.Xamarin -Version 1.5.2
        `,
      },
    ],
  },
  {
    type: StepType.CONFIGURE,
    description: (
      <p>
        {tct(
          'Initialize the SDK as early as possible, like in the constructor of the [appCode:App], and Add [sentryXamarinFormsIntegrationCode:SentryXamarinFormsIntegration] as a new Integration to [sentryXamarinOptionsCode:SentryXamarinOptions] if you are going to run your app with Xamarin Forms:',
          {
            appCode: <code />,
            sentryXamarinFormsIntegrationCode: <code />,
            sentryXamarinOptionsCode: <code />,
          }
        )}
      </p>
    ),
    configurations: [
      {
        description: <h5>{t('Android')}</h5>,
        configurations: [
          {
            description: (
              <p>
                {tct('Initialize the SDK on your [code:MainActivity].', {code: <code />})}
              </p>
            ),
            language: `csharp`,
            code: `
public class MainActivity : global::Xamarin.Forms.Platform.Android.FormsAppCompatActivity
{
    protected override void OnCreate(Bundle savedInstanceState)
    {
        SentryXamarin.Init(options =>
        {
            // Tells which project in Sentry to send events to:
            options.Dsn = "${dsn}";
            // When configuring for the first time, to see what the SDK is doing:
            options.Debug = true;
            // Set TracesSampleRate to 1.0 to capture 100% of transactions for performance monitoring.
            // We recommend adjusting this value in production.
            options.TracesSampleRate = 1.0;
            // If you installed Sentry.Xamarin.Forms:
            options.AddXamarinFormsIntegration();
        });
            `,
          },
        ],
      },
      {
        description: <h5>{t('iOS')}</h5>,
        configurations: [
          {
            description: (
              <p>
                {tct('Initialize the SDK on your [code:AppDelegate.cs].', {
                  code: <code />,
                })}
              </p>
            ),
            language: `csharp`,
            code: `
public partial class AppDelegate : global::Xamarin.Forms.Platform.iOS.FormsApplicationDelegate
{
    public override bool FinishedLaunching(UIApplication app, NSDictionary options)
    {
        SentryXamarin.Init(options =>
        {
            options.Dsn = "${dsn}";
            // When configuring for the first time, to see what the SDK is doing:
            options.Debug = true;
            // Set TracesSampleRate to 1.0 to capture 100% of transactions for performance monitoring.
            // We recommend adjusting this value in production.
            options.TracesSampleRate = 1.0;
            options.AddXamarinFormsIntegration();
        });
            `,
          },
        ],
      },
      {
        description: <h5>{t('UWP')}</h5>,
        configurations: [
          {
            description: (
              <Fragment>
                <p>
                  {tct('Initialize the SDK on [code:App.xaml.cs].', {
                    code: <code />,
                  })}
                </p>
                {t("NOTE: It's recommended to not setup the CacheDirectory for UWP.")}
              </Fragment>
            ),
            language: `csharp`,
            code: `
sealed partial class App : Application
{
    protected override void OnLaunched(LaunchActivatedEventArgs e)
    {
        SentryXamarin.Init(options =>
        {
            options.Dsn = "${dsn}";
            // When configuring for the first time, to see what the SDK is doing:
            options.Debug = true;
            // Set TracesSampleRate to 1.0 to capture 100% of transactions for performance monitoring.
            // We recommend adjusting this value in production.
            options.TracesSampleRate = 1.0;
            options.AddXamarinFormsIntegration();
        });
            `,
          },
        ],
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
    additionalInfo: t(
      'You might need to open the app again for the crash report to be sent to the server.'
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
          "Once you've verified the package is initialized properly and sent a test event, consider visiting our [link:complete Xamarin Forms docs].",
          {
            link: (
              <ExternalLink href="https://docs.sentry.io/platforms/dotnet/guides/xamarin/" />
            ),
          }
        )}
      </p>
    ),
  },
  {
    title: t('Limitations'),
    description: t(
      'There are no line numbers on stack traces for UWP and in release builds for Android and iOS.'
    ),
  },
  {
    title: t('Samples'),
    description: (
      <p>
        {tct(
          'You can find an example of a Xamarin Forms app with Sentry integrated [link:on this GitHub repository].',
          {
            link: (
              <ExternalLink href="https://github.com/getsentry/sentry-xamarin/tree/main/Samples" />
            ),
          }
        )}
      </p>
    ),
  },
];
// Configuration End

export function GettingStartedWithXamarin({dsn, ...props}: ModuleProps) {
  return <Layout steps={steps({dsn})} {...props} />;
}

export default GettingStartedWithXamarin;
