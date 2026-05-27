import {ExternalLink} from '@sentry/scraps/link';

import type {
  ContentBlock,
  DocsParams,
  OnboardingConfig,
} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {StepType} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {t, tct} from 'sentry/locale';
import {getPackageVersion} from 'sentry/utils/gettingStartedDocs/getPackageVersion';

const getInstallSnippet = (params: DocsParams, defaultVersion = '0.48.2') => {
  const version = getPackageVersion(params, 'sentry.rust', defaultVersion);
  return `[dependencies]
sentry = { version = "${version}", features = ["metrics"] }`;
};

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
      language: 'rust',
      code: `use sentry::metrics;

// Counter metric
metrics::counter("button_click", 1).capture();

// Gauge metric
metrics::gauge("queue.depth", 42).capture();

// Distribution metric
metrics::distribution("page_load", 15.5)
    .unit(sentry::protocol::Unit::Millisecond)
    .attribute("page", "/home")
    .capture();`,
    },
  ],
});

export const metrics: OnboardingConfig = {
  install: params => [
    {
      type: StepType.INSTALL,
      content: [
        {
          type: 'text',
          text: tct(
            'Metrics are supported in Sentry Rust SDK version [code:0.48.2] and above. The [code:metrics] feature flag needs to be enabled in your [code:Cargo.toml]:',
            {code: <code />}
          ),
        },
        {
          type: 'code',
          language: 'toml',
          code: getInstallSnippet(params),
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
            'Metrics are enabled by default when the [code:metrics] feature is included. You can emit metrics using the [code:sentry::metrics] API.',
            {code: <code />}
          ),
        },
        {
          type: 'code',
          language: 'rust',
          code: `let _guard = sentry::init(("${params.dsn.public}", sentry::ClientOptions {
    release: sentry::release_name!(),
    ..Default::default()
}));

use sentry::metrics;

// Counter metric
metrics::counter("button_click", 1).capture();

// Gauge metric
metrics::gauge("queue.depth", 42).capture();

// Distribution metric
metrics::distribution("page_load", 15.5)
    .unit(sentry::protocol::Unit::Millisecond)
    .attribute("page", "/home")
    .capture();`,
        },
        {
          type: 'text',
          text: tct(
            'For more detailed information, see the [link:metrics documentation].',
            {
              link: (
                <ExternalLink href="https://docs.sentry.io/platforms/rust/metrics/" />
              ),
            }
          ),
        },
      ],
    },
  ],
};
