import {ExternalLink} from 'sentry/components/core/link';
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
            'Install our PHP SDK with a minimum version that supports metrics ([code:4.19.0] or higher).',
            {
              code: <code />,
            }
          ),
        },
        {
          type: 'code',
          language: 'bash',
          code: 'composer require sentry/sentry',
        },
        {
          type: 'text',
          text: tct(
            'If you are on an older version of the SDK, follow our [link:migration guide] to upgrade.',
            {
              link: (
                <ExternalLink href="https://github.com/getsentry/sentry-php/blob/master/UPGRADE-4.0.md" />
              ),
            }
          ),
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
\\Sentry\\trace_metrics()->distribution('test-distribution', 20.0, ['my-attribute' => 'foo'], \\Sentry\\Unit::kilobyte())

// Somewhere at the end of your execution, you should flush
// to send pending metrics to Sentry.
\\Sentry\\trace_metrics()->flush();`,
        },
      ],
    },
  ],
};
