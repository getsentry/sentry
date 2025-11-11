import {ExternalLink} from 'sentry/components/core/link';
import {
  StepType,
  type ContentBlock,
  type DocsParams,
  type OnboardingConfig,
} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {t, tct} from 'sentry/locale';

import {getPythonInstallCodeBlock} from './utils';

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
      language: 'python',
      code: `from sentry_sdk import metrics

# Emit metrics
metrics.count("checkout.failed", 1)
metrics.gauge("queue.depth", 42)
metrics.distribution("cart.amount_usd", 187.5)`,
    },
  ],
});

export const metrics = ({
  packageName = 'sentry-sdk',
}: {
  packageName?: string;
} = {}): OnboardingConfig => ({
  install: () => [
    {
      type: StepType.INSTALL,
      content: [
        {
          type: 'text',
          text: tct(
            'Install our Python SDK with a minimum version that supports metrics ([code:2.44.0] or higher).',
            {
              code: <code />,
            }
          ),
        },
        getPythonInstallCodeBlock({
          packageName,
          minimumVersion: '2.44.0',
        }),
      ],
    },
  ],
  configure: (params: DocsParams) => [
    {
      type: StepType.CONFIGURE,
      content: [
        {
          type: 'text',
          text: tct(
            'Metrics are automatically enabled in your [code:sentry_sdk.init()] configuration. You can emit metrics using the [code:sentry_sdk.metrics] API.',
            {
              code: <code />,
            }
          ),
        },
        {
          type: 'code',
          language: 'python',
          code: `import sentry_sdk
from sentry_sdk import metrics

sentry_sdk.init(
  dsn="${params.dsn.public}",
)

# Emit custom metrics
metrics.count("checkout.failed", 1)
metrics.gauge("queue.depth", 42)
metrics.distribution("cart.amount_usd", 187.5)`,
        },
        {
          type: 'text',
          text: tct(
            'For more detailed information, see the [link:metrics documentation].',
            {
              link: (
                <ExternalLink href="https://docs.sentry.io/platforms/python/metrics/" />
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
      content: [metricsVerify(params)],
    },
  ],
});
