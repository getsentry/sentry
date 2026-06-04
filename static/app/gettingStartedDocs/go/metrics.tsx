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
      language: 'go',
      code: `meter := sentry.NewMeter(context.Background())

// Emit metrics
meter.Count("checkout.failed", 1)
meter.Gauge("queue.depth", 42)
meter.Distribution("cart.amount_usd", 187.5)`,
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
            'Install our Go SDK using [code:go get]. The minimum version of the SDK that supports metrics is [code:0.42.0].',
            {
              code: <code />,
            }
          ),
        },
        {
          type: 'code',
          language: 'bash',
          code: 'go get github.com/getsentry/sentry-go',
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
            'Metrics are automatically enabled when you initialize the SDK. You can emit metrics using the [code:sentry.NewMeter] API.',
            {
              code: <code />,
            }
          ),
        },
        {
          type: 'code',
          language: 'go',
          code: `import (
  "context"
  "github.com/getsentry/sentry-go"
  "github.com/getsentry/sentry-go/attribute"
)

func main() {
  err := sentry.Init(sentry.ClientOptions{
    Dsn: "${params.dsn.public}",
  })
  if err != nil {
    log.Fatalf("sentry.Init: %s", err)
  }
  defer sentry.Flush(2 * time.Second)

  meter := sentry.NewMeter(context.Background())

  // Counter metric
  meter.Count("button_click", 1)

  // Gauge metric
  meter.Gauge("queue_depth", 42.0)

  // Distribution metric
  meter.Distribution("response_time", 187.5)

  // Distribution metric with attributes and unit
  meter.Distribution("page_load", 1.0,
    sentry.WithUnit(sentry.UnitMillisecond),
    sentry.WithAttributes(
      attribute.String("browser", "Firefox"),
    ),
  )
}`,
        },
      ],
    },
  ],
};
