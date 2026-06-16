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

SentrySdk.Metrics.Increment("player_interaction",
    tags: new Dictionary<string, string> {{"action", "jump"}, {"scene", "main_menu"}});
SentrySdk.Metrics.Distribution("scene_load", 230,
    unit: MeasurementUnit.Duration.Millisecond,
    tags: new Dictionary<string, string> {{"scene", "world_1"}});
SentrySdk.Metrics.Gauge("active_players", 42,
    tags: new Dictionary<string, string> {{"server", "us-east-1"}});`,
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
            'Metrics for Unity are supported in Sentry SDK version [code:4.1.0] and above.',
            {
              code: <code />,
            }
          ),
        },
      ],
    },
  ],
  configure: (params: DocsParams) => [
    {
      type: StepType.CONFIGURE,
      content: [
        {
          type: 'text',
          text: t(
            'To enable metrics in your Unity game, you need to configure the Sentry SDK with metrics enabled.'
          ),
        },
        {
          type: 'text',
          text: tct(
            'Open your project settings: [strong:Tools > Sentry > Advanced > Metrics] and check the [strong:Enable Metrics] option.',
            {
              strong: <strong />,
            }
          ),
        },
        {
          type: 'text',
          text: t('Alternatively, you can enable metrics programmatically:'),
        },
        {
          type: 'code',
          language: 'csharp',
          code: `SentrySdk.Init(options =>
{
    options.Dsn = "${params.dsn.public}";

    // Enable metrics to be sent to Sentry
    options.ExperimentalMetrics = new ExperimentalMetricsOptions
    {
        EnableCodeLocations = true
    };
});`,
        },
      ],
    },
  ],
  verify: (params: DocsParams) => [
    {
      type: StepType.VERIFY,
      content: [metricsVerify(params)],
    },
  ],
};
