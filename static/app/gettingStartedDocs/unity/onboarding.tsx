import {ExternalLink} from 'sentry/components/core/link';
import {StoreCrashReportsConfig} from 'sentry/components/onboarding/gettingStartedDoc/storeCrashReportsConfig';
import type {
  DocsParams,
  OnboardingConfig,
  OnboardingStep,
} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {StepType} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {getConsoleExtensions} from 'sentry/components/onboarding/gettingStartedDoc/utils/consoleExtensions';
import {t, tct} from 'sentry/locale';

const getVerifySnippet = () => `
using Sentry; // On the top of the script

SentrySdk.CaptureMessage("Test event");`;

export const onboarding: OnboardingConfig = {
  install: () => [
    {
      type: StepType.INSTALL,
      content: [
        {
          type: 'text',
          text: tct(
            "Install the package via the [link:Unity Package Manager] using a Git URL to Sentry's SDK repository:",
            {
              link: (
                <ExternalLink href="https://docs.unity3d.com/Manual/upm-ui-giturl.html" />
              ),
            }
          ),
        },
        {
          type: 'code',
          language: 'url',
          code: 'https://github.com/getsentry/unity.git',
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
            "Access the Sentry configuration window by going to Unity's top menu: [code:Tools] > [code:Sentry] and enter the following DSN:",
            {code: <code />}
          ),
        },
        {
          type: 'code',
          language: 'url',
          code: params.dsn.public,
        },
        {
          type: 'text',
          text: t("And that's it! Now Sentry can capture errors automatically."),
        },
        {
          type: 'conditional',
          condition: params.isPerformanceSelected,
          content: [
            {
              type: 'text',
              text: tct(
                'To enable performance monitoring, set the [code:TracesSampleRate] option in the Sentry configuration window. For example, set it to [code:1.0] to capture 100% of transactions.',
                {code: <code />}
              ),
            },
          ],
        },
        {
          type: 'text',
          text: tct(
            'If you like additional contexts you could enable [link:Screenshots].',
            {
              link: (
                <ExternalLink href="https://docs.sentry.io/platforms/unity/enriching-events/screenshots/" />
              ),
            }
          ),
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
          text: t(
            'Once it is configured with the DSN you can call the SDK from anywhere:'
          ),
        },
        {
          type: 'code',
          language: 'csharp',
          code: getVerifySnippet(),
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
                code: `using Sentry;

// Transaction can be started by providing, at minimum, the name and the operation
var transaction = SentrySdk.StartTransaction(
    "test-transaction-name",
    "test-transaction-operation"
);

// Transactions can have child spans (and those spans can have child spans as well)
var span = transaction.StartChild("test-child-operation");

// ... Perform the operation

span.Finish(); // Mark the span as finished
transaction.Finish(); // Mark the transaction as finished and send it to Sentry`,
              },
              {
                type: 'text',
                text: tct(
                  'Check out [link:the documentation] to learn more about the API and automatic instrumentations.',
                  {
                    link: (
                      <ExternalLink href="https://docs.sentry.io/platforms/unity/tracing/" />
                    ),
                  }
                ),
              },
            ],
          },
        ] satisfies OnboardingStep[])
      : []),
    {
      title: t('Troubleshooting'),
      content: [
        {
          type: 'text',
          text: t(
            "Confirm the URL doesn't have a trailing whitespace at the end. The Unity Package Manager will fail to find the package if a trailing whitespace is appended."
          ),
        },
        {
          type: 'text',
          text: tct(
            "If you're running into any kind of issue please check out our [troubleshootingLink:troubleshooting page] or [raiseAnIssueLink:raise an issue].",
            {
              troubleshootingLink: (
                <ExternalLink href="https://docs.sentry.io/platforms/unity/troubleshooting/" />
              ),
              raiseAnIssueLink: (
                <ExternalLink href="https://github.com/getsentry/sentry-unity/issues/new?assignees=&labels=Platform%3A+Unity%2CType%3A+Bug&template=bug.md" />
              ),
            }
          ),
        },
      ],
    },
    ...([getConsoleExtensions(params)].filter(Boolean) as OnboardingStep[]),
    {
      title: t('Further Settings'),
      content: [
        {
          type: 'custom',
          content: (
            <StoreCrashReportsConfig
              organization={params.organization}
              projectSlug={params.project.slug}
            />
          ),
        },
      ],
    },
  ],
};
