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
  getCrashReportInstallDescription,
} from 'sentry/components/onboarding/gettingStartedDoc/utils/feedbackOnboarding';
import {t, tct} from 'sentry/locale';
import {getPackageVersion} from 'sentry/utils/gettingStartedDocs/getPackageVersion';

type Params = DocsParams;

const getConfigureSnippet = (params: Params) => `
# You need to import the module once in a script.
Import-Module Sentry

# Start the Sentry SDK with the default options.
# It may be helpful when investigating issues with your setup to pass \`-Debug\` to \`Start-Sentry\`.
# This enables debug logging (\`Write-Debug\`) for the Sentry client.
# We enable it here for demonstration purposes when first trying Sentry.
# You shouldn't do this in your applications unless you're troubleshooting issues with Sentry.
Start-Sentry -Debug {
    # A Sentry Data Source Name (DSN) is required.
    # See https://docs.sentry.io/product/sentry-basics/dsn-explainer/
    # You can set it in the SENTRY_DSN environment variable, or you can set it in code here.
    $_.Dsn = '${params.dsn}'

    # This option will enable Sentry's tracing features. You still need to start transactions and spans.
    # For example, setting the rate to 0.1 would capture 10% of transactions.
    $_.TracesSampleRate = 1.0
}

# Later on in your production script, you should omit the \`-Debug\` flag.:
Start-Sentry {
    $_.Dsn = '${params.dsn}'
    $_.TracesSampleRate = 0.1
}`;

const getPerformanceMonitoringSnippet = () => `
# Transaction can be started by providing, at minimum, the name and the operation
$transaction = Start-SentryTransaction 'test-transaction-name' 'test-transaction-operation'

# Transactions can have child spans (and those spans can have child spans as well)
$span = $transaction.StartChild("test-child-operation")
# ...
# (Perform the operation represented by the span/transaction)
# ...
$span.Finish() # Mark the span as finished

$span = $transaction.StartChild("another-span")
# ...
$span.Finish()

$transaction.Finish() # Mark the transaction as finished and send it to Sentry`;

const onboarding: OnboardingConfig = {
  introduction: () =>
    tct(
      'Sentry for PowerShell module supports PowerShell 7.2+ on Windows, macOS, and Linux as well as Windows PowerShell 5.1+.',
      {
        strong: <strong />,
        link: <ExternalLink href="https://docs.sentry.io/platforms/powershell/" />,
      }
    ),
  install: params => [
    {
      type: StepType.INSTALL,
      description: tct('Install the module:', {
        strong: <strong />,
      }),
      configurations: [
        {
          partialLoading: params.sourcePackageRegistries.isLoading,
          code: [
            {
              language: 'powershell',
              label: 'Install Module',
              value: 'powershellget',
              code: `Install-Module -Name Sentry -Repository PSGallery -RequiredVersion ${getPackageVersion(params, 'sentry.powershell', '1.0.0')} -Force`,
            },
          ],
        },
      ],
    },
  ],
  configure: params => [
    {
      type: StepType.CONFIGURE,
      description: tct('Initialize the SDK as early as possible.', {
        sentrySdkCode: <code />,
        programCode: <code />,
      }),
      configurations: [
        {
          language: 'powershell',
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
          language: 'powershell',
          code: '"Something went wrong" | Out-Sentry',
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
          language: 'powershell',
          code: getPerformanceMonitoringSnippet(),
        },
      ],
      additionalInfo: tct(
        'Check out [link:the documentation] to learn more about the API and instrumentations.',
        {
          link: (
            <ExternalLink href="https://docs.sentry.io/platforms/powershell/performance/instrumentation/" />
          ),
        }
      ),
    },
    {
      title: t('Samples'),
      description: t('You can find sample usage of the SDK:'),
      configurations: [
        {
          description: (
            <List symbol="bullet">
              <ListItem>
                {tct('[link:Samples in the [code:powershell] SDK repository]', {
                  link: (
                    <ExternalLink href="https://github.com/getsentry/sentry-powershell/tree/main/samples" />
                  ),
                  code: <code />,
                  strong: <strong />,
                })}
              </ListItem>
              <ListItem>
                {tct(
                  '[link:Many more samples in the [code:dotnet] SDK repository] [strong:(C#)]',
                  {
                    link: (
                      <ExternalLink href="https://github.com/getsentry/sentry-dotnet/tree/main/samples" />
                    ),
                    code: <code />,
                    strong: <strong />,
                  }
                )}
              </ListItem>
            </List>
          ),
        },
      ],
    },
  ],
};

export const powershellFeedbackOnboarding: OnboardingConfig = {
  introduction: () => getCrashReportApiIntroduction(),
  install: () => [
    {
      type: StepType.INSTALL,
      description: getCrashReportInstallDescription(),
      configurations: [
        {
          code: [
            {
              label: 'PowerShell',
              value: 'powershell',
              language: 'powershell',
              code: `$eventId = "An event that will receive user feedback." | Out-Sentry
[Sentry.SentrySdk]::CaptureUserFeedback($eventId, "user@example.com", "It broke.", "The User")`,
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

const docs: Docs = {
  onboarding,
  feedbackOnboardingCrashApi: powershellFeedbackOnboarding,
};

export default docs;
