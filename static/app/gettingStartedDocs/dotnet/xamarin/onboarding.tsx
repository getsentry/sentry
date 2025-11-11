import {ExternalLink} from 'sentry/components/core/link';
import type {
  DocsParams,
  OnboardingConfig,
} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {StepType} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {t, tct} from 'sentry/locale';
import {getPackageVersion} from 'sentry/utils/gettingStartedDocs/getPackageVersion';

const getInstallSnippetXamarin = (params: DocsParams) => `
Install-Package Sentry.Xamarin -Version ${getPackageVersion(
  params,
  'sentry.dotnet.xamarin',
  '1.5.2'
)}`;

const getInstallSnippetXamarinForms = (params: DocsParams) => `
Install-Package Sentry.Xamarin.Forms -Version ${getPackageVersion(
  params,
  'sentry.dotnet.xamarin-forms',
  '1.5.2'
)}`;

const getConfigureSnippetAndroid = (params: DocsParams) => `
public class MainActivity : global::Xamarin.Forms.Platform.Android.FormsAppCompatActivity
{
    protected override void OnCreate(Bundle savedInstanceState)
    {
        SentryXamarin.Init(options =>
        {
            // Tells which project in Sentry to send events to:
            options.Dsn = "${params.dsn.public}";
            // When configuring for the first time, to see what the SDK is doing:
            options.Debug = true;
            // Set TracesSampleRate to 1.0 to capture 100% of transactions for tracing.
            // We recommend adjusting this value in production.
            options.TracesSampleRate = 1.0;
            // If you installed Sentry.Xamarin.Forms:
            options.AddXamarinFormsIntegration();
        });`;

const getConfigureSnippetIOS = (params: DocsParams) => `
public partial class AppDelegate : global::Xamarin.Forms.Platform.iOS.FormsApplicationDelegate
{
    public override bool FinishedLaunching(UIApplication app, NSDictionary options)
    {
        SentryXamarin.Init(options =>
        {
            options.Dsn = "${params.dsn.public}";
            // When configuring for the first time, to see what the SDK is doing:
            options.Debug = true;
            // Set TracesSampleRate to 1.0 to capture 100% of transactions for tracing.
            // We recommend adjusting this value in production.
            options.TracesSampleRate = 1.0;
            options.AddXamarinFormsIntegration();
        });`;

const getConfigureSnippetUWP = (params: DocsParams) => `
sealed partial class App : Application
{
    protected override void OnLaunched(LaunchActivatedEventArgs e)
    {
        SentryXamarin.Init(options =>
        {
            options.Dsn = "${params.dsn.public}";
            // When configuring for the first time, to see what the SDK is doing:
            options.Debug = true;
            // Set TracesSampleRate to 1.0 to capture 100% of transactions for tracing.
            // We recommend adjusting this value in production.
            options.TracesSampleRate = 1.0;
            options.AddXamarinFormsIntegration();
        });`;

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
              label: 'Xamarin.Forms',
              language: 'shell',
              code: getInstallSnippetXamarinForms(params),
            },
            {
              label: 'Xamarin',
              language: 'shell',
              code: getInstallSnippetXamarin(params),
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
            'Initialize the SDK as early as possible, like in the constructor of the [code:App], and Add [code:SentryXamarinFormsIntegration] as a new Integration to [code:SentryXamarinOptions] if you are going to run your app with Xamarin Forms:',
            {
              code: <code />,
            }
          ),
        },
        {
          type: 'subheader',
          text: t('Android'),
        },
        {
          type: 'text',
          text: tct('Initialize the SDK on your [code:MainActivity].', {
            code: <code />,
          }),
        },
        {
          type: 'code',
          language: 'csharp',
          code: getConfigureSnippetAndroid(params),
        },
        {
          type: 'subheader',
          text: t('iOS'),
        },
        {
          type: 'text',
          text: tct('Initialize the SDK on your [code:AppDelegate.cs].', {
            code: <code />,
          }),
        },
        {
          type: 'code',
          language: 'csharp',
          code: getConfigureSnippetIOS(params),
        },
        {
          type: 'subheader',
          text: t('UWP'),
        },
        {
          type: 'text',
          text: [
            tct('Initialize the SDK on [code:App.xaml.cs].', {
              code: <code />,
            }),
            t("NOTE: It's recommended to not setup the CacheDirectory for UWP."),
          ],
        },
        {
          type: 'code',
          language: 'csharp',
          code: getConfigureSnippetUWP(params),
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
          text: t(
            'You might need to open the app again for the crash report to be sent to the server.'
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
            "Once you've verified the package is initialized properly and sent a test event, consider visiting our [link:complete Xamarin Forms docs].",
            {
              link: (
                <ExternalLink href="https://docs.sentry.io/platforms/dotnet/guides/xamarin/" />
              ),
            }
          ),
        },
      ],
    },
    {
      title: t('Limitations'),
      content: [
        {
          type: 'text',
          text: t(
            'There are no line numbers on stack traces for UWP and in release builds for Android and iOS.'
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
            'You can find an example of a Xamarin Forms app with Sentry integrated [link:on this GitHub repository].',
            {
              link: (
                <ExternalLink href="https://github.com/getsentry/sentry-xamarin/tree/main/Samples" />
              ),
            }
          ),
        },
      ],
    },
  ],
};
