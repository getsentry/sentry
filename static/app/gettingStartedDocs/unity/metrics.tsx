import {ExternalLink} from '@sentry/scraps/link';

import type {
  ContentBlock,
  DocsParams,
  OnboardingConfig,
} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {StepType} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {t, tct} from 'sentry/locale';

export const metricsVerify = (params: DocsParams): ContentBlock => ({
  type: 'conditional',
  condition: params.isMetricsSelected,
  content: [
    {
      type: 'text',
      text: t(
        'Send test metrics from your app to verify metrics are arriving in Sentry.'
      ),
    },
    {
      type: 'code',
      language: 'csharp',
      code: `using Sentry;

SentrySdk.Metrics.EmitCounter("player_interaction", 1,
    new Dictionary<string, object> { ["action"] = "jump", ["scene"] = "main_menu" });
SentrySdk.Metrics.EmitDistribution("scene_load", 230, MeasurementUnit.Duration.Millisecond,
    new Dictionary<string, object> { ["scene"] = "world_1" });
SentrySdk.Metrics.EmitGauge("active_players", 42, MeasurementUnit.None,
    new Dictionary<string, object> { ["server"] = "us-east-1" });`,
    },
    {
      type: 'text',
      text: tct('For more detailed information, see the [link:metrics documentation].', {
        link: <ExternalLink href="https://docs.sentry.io/platforms/unity/metrics/" />,
      }),
    },
  ],
});

export const metrics: OnboardingConfig = {
  install: () => [
    {
      type: StepType.INSTALL,
      content: [
        {
          type: 'text',
          text: tct(
            'Metrics for Unity are supported in Sentry SDK version [code:4.2.0] and above.',
            {
              code: <code />,
            }
          ),
        },
      ],
    },
  ],
  configure: () => [],
  verify: (params: DocsParams) => [
    {
      type: StepType.VERIFY,
      content: [
        {
          type: 'text',
          text: tct(
            'Metrics are enabled by default. You can emit metrics using the [code:SentrySdk.Metrics] API.',
            {
              code: <code />,
            }
          ),
        },
        metricsVerify(params),
      ],
    },
  ],
};
