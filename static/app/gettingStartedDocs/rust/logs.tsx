import {ExternalLink} from 'sentry/components/core/link';
import type {
  DocsParams,
  OnboardingConfig,
} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {StepType} from 'sentry/components/onboarding/gettingStartedDoc/types';
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

export const logs: OnboardingConfig = {
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
            'Additionally, you can also configure [link:logging integrations] with crates like [code:tracing] or [code:log].',
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
