import {ExternalLink} from 'sentry/components/core/link';
import type {
  Docs,
  DocsParams,
  OnboardingConfig,
} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {StepType} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {
  getCrashReportBackendInstallSteps,
  getCrashReportModalConfigDescription,
  getCrashReportModalIntroduction,
} from 'sentry/components/onboarding/gettingStartedDoc/utils/feedbackOnboarding';
import {t, tct} from 'sentry/locale';
import {getPackageVersion} from 'sentry/utils/gettingStartedDocs/getPackageVersion';

type Params = DocsParams;

const getInstallSnippet = (params: Params, defaultVersion = '0.42.0') => {
  const version = getPackageVersion(params, 'sentry.rust', defaultVersion);
  return params.isLogsSelected
    ? `
[dependencies]
sentry = { version = "${version}", features = ["logs"] }`
    : `
[dependencies]
sentry = "${version}"`;
};

const getConfigureSnippet = (params: Params) => `
let _guard = sentry::init(("${params.dsn.public}", sentry::ClientOptions {
  release: sentry::release_name!(),
  // Capture user IPs and potentially sensitive headers when using HTTP server integrations
  // see https://docs.sentry.io/platforms/rust/data-management/data-collected for more info
  send_default_pii: true,
  ..Default::default()
}));`;

const getVerifySnippet = (params: Params) => `
fn main() {
  let _guard = sentry::init(("${params.dsn.public}", sentry::ClientOptions {
    release: sentry::release_name!(),
    // Capture user IPs and potentially sensitive headers when using HTTP server integrations
    // see https://docs.sentry.io/platforms/rust/data-management/data-collected for more info
    send_default_pii: true,
    ..Default::default()
  }));

  // Sentry will capture this
  panic!("Everything is on fire!");
}`;

const onboarding: OnboardingConfig = {
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
      ],
    },
  ],
};

const crashReportOnboarding: OnboardingConfig = {
  introduction: () => getCrashReportModalIntroduction(),
  install: (params: Params) => getCrashReportBackendInstallSteps(params),
  configure: () => [
    {
      type: StepType.CONFIGURE,
      content: [
        {
          type: 'text',
          text: getCrashReportModalConfigDescription({
            link: 'https://docs.sentry.io/platforms/rust/user-feedback/configuration/#crash-report-modal',
          }),
        },
      ],
    },
  ],
  verify: () => [],
  nextSteps: () => [],
};

const logsOnboarding: OnboardingConfig = {
  install: params => [
    {
      type: StepType.INSTALL,
      content: [
        {
          type: 'text',
          text: tct(
            'Logs in Rust are supported in Sentry Rust SDK version [code:0.42.0] and above. Additionally, the [code:logs] feature flag needs to be enabled.',
            {
              code: <code />,
            }
          ),
        },
        {
          type: 'code',
          language: 'rust',
          code: getInstallSnippet(params, '0.42.0'),
        },
      ],
    },
  ],
  configure: (params: Params) => [
    {
      type: StepType.CONFIGURE,
      content: [
        {
          type: 'text',
          text: tct(
            'To enable logging, you need to initialize the SDK with the [code:enable_logs] option set to true.',
            {
              code: <code />,
            }
          ),
        },
        {
          type: 'code',
          language: 'rust',
          code: `let _guard = sentry::init((
    "${params.dsn.public}",
    sentry::ClientOptions {
        release: sentry::release_name!(),
        enable_logs: true,
        ..Default::default()
    }
));`,
        },
        {
          type: 'text',
          text: tct(
            'Additionally, you can also configure [link:logging integrations] with crates like [code:tracing] or [code:log4rs].',
            {
              code: <code />,
              link: (
                <ExternalLink href="https://docs.sentry.io/platforms/rust/logs/#integrations" />
              ),
            }
          ),
        },
      ],
    },
  ],
  verify: () => [
    {
      type: StepType.VERIFY,
      content: [
        {
          type: 'text',
          text: t('Send a test log from your app to verify logs are arriving in Sentry.'),
        },
        {
          type: 'code',
          language: 'rust',
          code: `use sentry::logger_info;

logger_info!(
    log_type = "test",
    log.source = "sentry_rust_sdk",
    "Log sent for testing"
);`,
        },
      ],
    },
  ],
};

const docs: Docs = {
  onboarding,
  crashReportOnboarding,
  logsOnboarding,
};

export default docs;
