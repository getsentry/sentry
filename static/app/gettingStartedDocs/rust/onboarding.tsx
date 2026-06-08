import type {
  DocsParams,
  OnboardingConfig,
} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {StepType} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {t, tct} from 'sentry/locale';
import {getPackageVersion} from 'sentry/utils/gettingStartedDocs/getPackageVersion';

import {metricsVerify} from './metrics';

type Params = DocsParams;

const getInstallSnippet = (params: Params, defaultVersion = '0.42.0') => {
  const version = getPackageVersion(params, 'sentry.rust', defaultVersion);
  const features: string[] = [];
  if (params.isLogsSelected) {
    features.push('"logs"');
  }
  if (params.isMetricsSelected) {
    features.push('"metrics"');
  }
  return features.length > 0
    ? `
[dependencies]
sentry = { version = "${version}", features = [${features.join(', ')}] }`
    : `
[dependencies]
sentry = "${version}"`;
};

const getConfigureSnippet = (params: Params) => `
let _guard = sentry::init(("${params.dsn.public}", sentry::ClientOptions {
  release: sentry::release_name!(),
  // Capture user IPs and potentially sensitive headers when using HTTP server integrations
  // see https://docs.sentry.io/platforms/rust/data-management/data-collected for more info
  send_default_pii: true,${
    params.isPerformanceSelected
      ? `
  // Set traces_sample_rate to 1.0 to capture 100%
  // of transactions for tracing.
  traces_sample_rate: 1.0,`
      : ''
  }${
    params.isLogsSelected
      ? `
  // Enable sending logs to Sentry
  enable_logs: true,`
      : ''
  }
  ..Default::default()
}));`;

const getVerifySnippet = (params: Params) => `
fn main() {
  let _guard = sentry::init(("${params.dsn.public}", sentry::ClientOptions {
    release: sentry::release_name!(),
    // Capture user IPs and potentially sensitive headers when using HTTP server integrations
    // see https://docs.sentry.io/platforms/rust/data-management/data-collected for more info
    send_default_pii: true,${
      params.isPerformanceSelected
        ? `
    // Set traces_sample_rate to 1.0 to capture 100%
    // of transactions for tracing.
    traces_sample_rate: 1.0,`
        : ''
    }${
      params.isLogsSelected
        ? `
    // Enable sending logs to Sentry
    enable_logs: true,`
        : ''
    }
    ..Default::default()
  }));

  // Sentry will capture this
  panic!("Everything is on fire!");
}`;

export const onboarding: OnboardingConfig = {
  install: params => [
    {
      type: StepType.INSTALL,
      content: [
        {
          type: 'text',
          text: tct(
            'To add Sentry to your Rust project you just need to add a new dependency to your [code:Cargo.toml]:',
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
  configure: params => [
    {
      type: StepType.CONFIGURE,
      content: [
        {
          type: 'text',
          text: tct(
            '[code:sentry::init()] will return you a guard that when freed, will prevent process exit until all events have been sent (within a timeout):',
            {code: <code />}
          ),
        },
        {
          type: 'code',
          language: 'rust',
          code: getConfigureSnippet(params),
        },
      ],
    },
  ],
  verify: params => [
    {
      type: StepType.VERIFY,
      content: [
        {
          type: 'text',
          text: t(
            'The quickest way to verify Sentry in your Rust application is to cause a panic:'
          ),
        },
        {
          type: 'code',
          language: 'rust',
          code: getVerifySnippet(params),
        },
        metricsVerify(params),
      ],
    },
  ],
};
