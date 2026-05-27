import {ExternalLink} from '@sentry/scraps/link';

import type {
  ContentBlock,
  DocsParams,
  OnboardingConfig,
} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {StepType} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {t, tct} from 'sentry/locale';

const getInstallSnippet = () => `
defp deps do
  [
    # ...
    {:sentry, "~> 13.0"},
    {:jason, "~> 1.2"},
    {:hackney, "~> 1.8"}
  ]
end`;

const getVerifySnippet = (params: DocsParams) => `
config :sentry,
  dsn: "${params.dsn.public}",
  environment_name: Mix.env()

# Counter metric
Sentry.Metrics.count(
  "button_click",
  5,
  attributes: %{browser: "Firefox", app_version: "1.0.0"}
)

# Gauge metric
Sentry.Metrics.gauge(
  "page_load",
  15.0,
  unit: "millisecond",
  attributes: %{page: "/home"}
)

# Distribution metric
Sentry.Metrics.distribution(
  "page_load",
  15.0,
  unit: "millisecond",
  attributes: %{page: "/home"}
)`;

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
      language: 'elixir',
      code: `# Counter metric
Sentry.Metrics.count("button_click", 1)

# Gauge metric
Sentry.Metrics.gauge("queue.depth", 42)

# Distribution metric
Sentry.Metrics.distribution("page_load", 15.0,
  unit: "millisecond",
  attributes: %{page: "/home"}
)`,
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
            'Metrics are supported in Sentry Elixir SDK version [code:13.0.0] and above. Make sure your [code:mix.exs] specifies at least this version:',
            {code: <code />}
          ),
        },
        {
          type: 'code',
          language: 'elixir',
          code: getInstallSnippet(),
        },
        {
          type: 'text',
          text: tct('Then fetch the updated dependency: [code:mix deps.get]', {
            code: <code />,
          }),
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
            'Metrics are automatically enabled. You can emit metrics using the [code:Sentry.Metrics] module.',
            {code: <code />}
          ),
        },
        {
          type: 'code',
          language: 'elixir',
          code: getVerifySnippet(params),
        },
        {
          type: 'text',
          text: tct(
            'For more detailed information, see the [link:metrics documentation].',
            {
              link: (
                <ExternalLink href="https://docs.sentry.io/platforms/elixir/metrics/" />
              ),
            }
          ),
        },
      ],
    },
  ],
};
