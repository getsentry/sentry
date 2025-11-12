import {ExternalLink} from 'sentry/components/core/link';
import {
  StepType,
  type OnboardingConfig,
} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {t, tct} from 'sentry/locale';

import {onboarding} from './onboarding';

export const performance: OnboardingConfig = {
  introduction: () =>
    t(
      "Adding Performance to your Django project is simple. Make sure you've got these basics down."
    ),
  install: onboarding.install,
  configure: params => [
    {
      type: StepType.CONFIGURE,
      content: [
        {
          type: 'text',
          text: tct(
            'To configure the Sentry SDK, initialize it in your [code:settings.py] file:',
            {code: <code />}
          ),
        },
        {
          type: 'code',
          language: 'python',
          code: `
import sentry_sdk

sentry_sdk.init(
    dsn="${params.dsn.public}",

    # Set traces_sample_rate to 1.0 to capture 100%
    # of transactions for performance monitoring.
    traces_sample_rate=1.0,
)`,
        },
        {
          type: 'text',
          text: tct(
            'Learn more about tracing [linkTracingOptions:options], how to use the [linkTracesSampler:traces_sampler] function, or how to do [linkSampleTransactions:sampling].',
            {
              linkTracingOptions: (
                <ExternalLink href="https://docs.sentry.io/platforms/python/configuration/options/#tracing-options" />
              ),
              linkTracesSampler: (
                <ExternalLink href="https://docs.sentry.io/platforms/python/configuration/sampling/" />
              ),
              linkSampleTransactions: (
                <ExternalLink href="https://docs.sentry.io/platforms/python/configuration/sampling/" />
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
            'Verify that performance monitoring is working correctly with our [link:automatic instrumentation] by simply using your Python application.',
            {
              link: (
                <ExternalLink href="https://docs.sentry.io/platforms/python/tracing/instrumentation/automatic-instrumentation/" />
              ),
            }
          ),
        },
      ],
    },
  ],
  nextSteps: () => [],
};
