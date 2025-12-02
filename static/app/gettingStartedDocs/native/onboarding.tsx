import {ExternalLink} from 'sentry/components/core/link';
import type {
  DocsParams,
  OnboardingConfig,
  OnboardingStep,
} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {StepType} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {getConsoleExtensions} from 'sentry/components/onboarding/gettingStartedDoc/utils/consoleExtensions';
import {getVerifySnippet} from 'sentry/gettingStartedDocs/native/utils';
import {t, tct} from 'sentry/locale';

const getConfigureSnippet = (params: DocsParams) => `
#include <sentry.h>

int main(void) {
  sentry_options_t *options = sentry_options_new();
  sentry_options_set_dsn(options, "${params.dsn.public}");
  // This is also the default-path. For further information and recommendations:
  // https://docs.sentry.io/platforms/native/configuration/options/#database-path
  sentry_options_set_database_path(options, ".sentry-native");
  sentry_options_set_release(options, "my-project-name@2.3.12");
  sentry_options_set_debug(options, 1);${
    params.isPerformanceSelected
      ? `
  // Set traces_sample_rate to 1.0 to capture 100% of transactions for tracing.
  // We recommend adjusting this value in production.
  sentry_options_set_traces_sample_rate(options, 1.0);`
      : ''
  }
  sentry_init(options);

  /* ... */

  // make sure everything flushes
  sentry_close();
}`;

export const onboarding: OnboardingConfig = {
  install: () => [
    {
      type: StepType.INSTALL,
      content: [
        {
          type: 'text',
          text: tct(
            'Install the SDK by downloading the [releasesLink:latest release]. Next, follow the instructions in the [nativeSDKDocumentationLink:Native SDK Documentation] to build and link the SDK library.',
            {
              releasesLink: (
                <ExternalLink href="https://github.com/getsentry/sentry-native/releases" />
              ),
              nativeSDKDocumentationLink: (
                <ExternalLink href="https://docs.sentry.io/platforms/native/" />
              ),
            }
          ),
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
          text: t(
            'Import and initialize the Sentry SDK early in your application setup:'
          ),
        },
        {
          type: 'code',
          language: 'c',
          code: getConfigureSnippet(params),
        },
        {
          type: 'text',
          text: tct(
            'Alternatively, the DSN can be passed as [code:SENTRY_DSN] environment variable during runtime. This can be especially useful for server applications.',
            {
              code: <code />,
            }
          ),
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
          text: t(
            'The quickest way to verify Sentry in your Native application is by capturing a message:'
          ),
        },
        {
          type: 'code',
          language: 'c',
          code: getVerifySnippet(),
        },
        {
          type: 'text',
          text: t(
            "If you're new to Sentry, use the email alert to access your account and complete a product tour."
          ),
        },
        {
          type: 'text',
          text: t(
            "If you're an existing user and have disabled alerts, you won't receive this email."
          ),
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
                language: 'c',
                code: `sentry_transaction_context_t *tx_ctx = sentry_transaction_context_new(
  "test-transaction",
  "test-operation"
);
sentry_transaction_t *tx = sentry_transaction_start(tx_ctx, NULL);

// Perform your operation
// ...

sentry_transaction_finish(tx);`,
              },
              {
                type: 'text',
                text: tct(
                  'Check out [link:the documentation] to learn more about tracing and custom instrumentation.',
                  {
                    link: (
                      <ExternalLink href="https://docs.sentry.io/platforms/native/tracing/" />
                    ),
                  }
                ),
              },
            ],
          },
        ] satisfies OnboardingStep[])
      : []),
    ...([getConsoleExtensions(params)].filter(Boolean) as OnboardingStep[]),
  ],
};
