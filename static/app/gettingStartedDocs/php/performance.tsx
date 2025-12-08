import {ExternalLink} from 'sentry/components/core/link';
import type {OnboardingConfig} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {StepType} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {t, tct} from 'sentry/locale';

import {onboarding} from './onboarding';

export const performance: OnboardingConfig = {
  introduction: () =>
    t(
      "Adding Performance to your PHP project is simple. Make sure you've got these basics down."
    ),
  install: onboarding.install,
  configure: params => [
    {
      type: StepType.CONFIGURE,
      content: [
        {
          type: 'text',
          text: t(
            'To capture all errors and transactions, even the one during the startup of your application, you should initialize the Sentry PHP SDK as soon as possible.'
          ),
        },
        {
          type: 'text',
          text: tct(
            'To initialize the SDK before everything else, create an external file called [code:instrument.js/mjs] and make sure to import it in your apps entrypoint before anything else.',
            {code: <code />}
          ),
        },
        {
          type: 'code',
          language: 'php',
          code: `
\\Sentry\\init([
  'dsn' => '${params.dsn.public}',

  // Set tracesSampleRate to 1.0 to capture 100%
  // of transactions for performance monitoring.
  'traces_sample_rate' => 1.0,
]);
`,
        },
        {
          type: 'text',
          text: tct(
            'We recommend adjusting the value of [code:tracesSampleRate] in production. Learn more about tracing [linkTracingOptions:options], how to use the [linkTracesSampler:traces_sampler] function, or how to do [linkSampleTransactions:sampling].',
            {
              code: <code />,
              linkTracingOptions: (
                <ExternalLink href="https://docs.sentry.io/platforms/php/configuration/options/" />
              ),
              linkTracesSampler: (
                <ExternalLink href="https://docs.sentry.io/platforms/php/configuration/sampling/" />
              ),
              linkSampleTransactions: (
                <ExternalLink href="https://docs.sentry.io/platforms/php/configuration/sampling/" />
              ),
            }
          ),
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
          text: tct(
            'Verify that performance monitoring is working correctly with our [link:automatic instrumentation] by simply using your Node application.',
            {
              link: (
                <ExternalLink href="https://docs.sentry.io/platforms/php/tracing/instrumentation/automatic-instrumentation/" />
              ),
            }
          ),
        },
      ],
    },
  ],
  nextSteps: () => [],
};
