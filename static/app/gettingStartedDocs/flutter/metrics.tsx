import {ExternalLink} from 'sentry/components/core/link';
import type {OnboardingConfig} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {StepType} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {tct} from 'sentry/locale';

const getMetricsCode = () => `import 'package:sentry_flutter/sentry_flutter.dart';

// Counter metric - track occurrences
Sentry.metrics.count('orders_created', 1);

// Gauge metric - track a value that can go up and down
Sentry.metrics.gauge('active_connections', 42);

// Distribution metric - track a value distribution
Sentry.metrics.distribution(
  'api_latency',
  187,
  unit: SentryMetricUnit.millisecond,
);`;

export const metrics: OnboardingConfig = {
  install: () => [
    {
      type: StepType.INSTALL,
      content: [
        {
          type: 'text',
          text: tct(
            'To start using metrics, make sure your Sentry Flutter SDK version is [version:9.11.0] or higher.',
            {
              version: <code />,
            }
          ),
        },
      ],
    },
  ],
  configure: () => [],
  verify: () => [
    {
      type: StepType.VERIFY,
      content: [
        {
          type: 'text',
          text: tct(
            'Metrics are automatically enabled in your Sentry SDK configuration. You can emit metrics using the [code:Sentry.metrics] API.',
            {
              code: <code />,
            }
          ),
        },
        {
          type: 'code',
          language: 'dart',
          code: getMetricsCode(),
        },
        {
          type: 'text',
          text: tct(
            'For more detailed information, see the [link:metrics documentation].',
            {
              link: (
                <ExternalLink href="https://docs.sentry.io/platforms/dart/guides/flutter/metrics/" />
              ),
            }
          ),
        },
      ],
    },
  ],
};
