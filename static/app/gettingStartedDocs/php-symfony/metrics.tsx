import type {OnboardingConfig} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {StepType} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {tct} from 'sentry/locale';

export const metrics: OnboardingConfig = {
  install: () => [
    {
      type: StepType.INSTALL,
      content: [
        {
          type: 'text',
          text: tct(
            'Install our Symfony SDK with a minimum version that supports metrics ([code:5.8.0] or higher).',
            {
              code: <code />,
            }
          ),
        },
        {
          type: 'code',
          language: 'bash',
          code: 'composer require sentry/sentry-symfony',
        },
      ],
    },
  ],
  configure: () => [],
  verify: params => [
    {
      type: StepType.VERIFY,
      content: [
        {
          type: 'text',
          text: tct(
            'Metrics are automatically enabled in your [code:\\Sentry\\init] configuration. You can emit metrics using the [code:\\Sentry\\trace_metrics()] API.',
            {
              code: <code />,
            }
          ),
        },
        {
          type: 'code',
          language: 'php',
          code: `\\Sentry\\init([
  'dsn' => '${params.dsn.public}',
]);

// Counter metric
\\Sentry\\trace_metrics()->count('test-counter', 10, ['my-attribute' => 'foo']);

// Gauge metric
\\Sentry\\trace_metrics()->gauge('test-gauge', 50.0, ['my-attribute' => 'foo'], \\Sentry\\Unit::millisecond());

// Distribution metric
\\Sentry\\trace_metrics()->distribution('test-distribution', 20.0, ['my-attribute' => 'foo'], \\Sentry\\Unit::kilobyte())`,
        },
      ],
    },
  ],
};
