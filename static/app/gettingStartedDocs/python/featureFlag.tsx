import {SdkProviderEnum as FeatureFlagProviderEnum} from 'sentry/components/events/featureFlags/utils';
import type {OnboardingConfig} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {StepType} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {t, tct} from 'sentry/locale';

import {getPythonInstallCodeBlock} from './utils';

type FeatureFlagConfiguration = {
  integrationName: string;
  makeConfigureCode: (dsn: string) => string;
  makeVerifyCode: () => string;
  packageName: string;
};

const FEATURE_FLAG_CONFIGURATION_MAP: Record<
  FeatureFlagProviderEnum,
  FeatureFlagConfiguration
> = {
  [FeatureFlagProviderEnum.GENERIC]: {
    integrationName: ``,
    packageName: 'sentry-sdk',
    makeConfigureCode: (dsn: string) => `sentry_sdk.init(
    dsn="${dsn}",
    # Add data like request headers and IP for users, if applicable;
    # see https://docs.sentry.io/platforms/python/data-management/data-collected/ for more info
    send_default_pii=True,
    integrations=[
        # your other integrations here
    ],
)`,
    makeVerifyCode: () => `import sentry_sdk
from sentry_sdk.feature_flags import add_feature_flag

add_feature_flag('test-flag', False)  # Records an evaluation and its result.
sentry_sdk.capture_exception(Exception("Something went wrong!"))`,
  },

  [FeatureFlagProviderEnum.LAUNCHDARKLY]: {
    integrationName: `LaunchDarklyIntegration`,
    packageName: "'sentry-sdk[launchdarkly]'",
    makeConfigureCode: (dsn: string) => `import sentry_sdk
from sentry_sdk.integrations.launchdarkly import LaunchDarklyIntegration
import ldclient

sentry_sdk.init(
    dsn="${dsn}",
    # Add data like request headers and IP for users, if applicable;
    # see https://docs.sentry.io/platforms/python/data-management/data-collected/ for more info
    send_default_pii=True,
    integrations=[
        LaunchDarklyIntegration(),
    ],
)`,
    makeVerifyCode: () => `client = ldclient.get()
client.variation("hello", Context.create("test-context"), False)  # Evaluate a flag with a default value.
sentry_sdk.capture_exception(Exception("Something went wrong!"))`,
  },

  [FeatureFlagProviderEnum.OPENFEATURE]: {
    integrationName: `OpenFeatureIntegration`,
    packageName: "'sentry-sdk[openfeature]'",
    makeConfigureCode: (dsn: string) => `import sentry_sdk
from sentry_sdk.integrations.openfeature import OpenFeatureIntegration
from openfeature import api

sentry_sdk.init(
    dsn="${dsn}",
    # Add data like request headers and IP for users, if applicable;
    # see https://docs.sentry.io/platforms/python/data-management/data-collected/ for more info
    send_default_pii=True,
    integrations=[
        OpenFeatureIntegration(),
    ],
)`,
    makeVerifyCode: () => `client = api.get_client()
client.get_boolean_value("hello", default_value=False)  # Evaluate a flag with a default value.
sentry_sdk.capture_exception(Exception("Something went wrong!"))`,
  },

  [FeatureFlagProviderEnum.STATSIG]: {
    integrationName: `StatsigIntegration`,
    packageName: "'sentry-sdk[statsig]'",
    makeConfigureCode: (dsn: string) => `import sentry_sdk
from sentry_sdk.integrations.statsig import StatsigIntegration
from statsig.statsig_user import StatsigUser
from statsig import statsig
import time

sentry_sdk.init(
    dsn="${dsn}",
    # Add data like request headers and IP for users, if applicable;
    # see https://docs.sentry.io/platforms/python/data-management/data-collected/ for more info
    send_default_pii=True,
    integrations=[StatsigIntegration()],
)
statsig.initialize("server-secret-key")`,
    makeVerifyCode: () => `while not statsig.is_initialized():
    time.sleep(0.2)

result = statsig.check_gate(StatsigUser("my-user-id"), "my-feature-gate")  # Evaluate a flag.
sentry_sdk.capture_exception(Exception("Something went wrong!"))`,
  },

  [FeatureFlagProviderEnum.UNLEASH]: {
    integrationName: `UnleashIntegration`,
    packageName: "'sentry-sdk[unleash]'",
    makeConfigureCode: (dsn: string) => `import sentry_sdk
from sentry_sdk.integrations.unleash import UnleashIntegration
from UnleashClient import UnleashClient

sentry_sdk.init(
    dsn="${dsn}",
    # Add data like request headers and IP for users, if applicable;
    # see https://docs.sentry.io/platforms/python/data-management/data-collected/ for more info
    send_default_pii=True,
    integrations=[UnleashIntegration()],
)

unleash = UnleashClient(...)  # See Unleash quickstart.
unleash.initialize_client()`,
    makeVerifyCode:
      () => `test_flag_enabled = unleash.is_enabled("test-flag")  # Evaluate a flag.
sentry_sdk.capture_exception(Exception("Something went wrong!"))`,
  },
};

export const featureFlag: OnboardingConfig = {
  install: () => [],
  configure: ({featureFlagOptions = {integration: ''}, dsn}) => {
    const {integrationName, packageName, makeConfigureCode, makeVerifyCode} =
      FEATURE_FLAG_CONFIGURATION_MAP[
        featureFlagOptions.integration as keyof typeof FEATURE_FLAG_CONFIGURATION_MAP
      ];

    return [
      {
        type: StepType.INSTALL,
        content: [
          {
            type: 'text',
            text:
              featureFlagOptions.integration === FeatureFlagProviderEnum.GENERIC
                ? t('Install the Sentry SDK.')
                : t('Install the Sentry SDK with an extra.'),
          },
          getPythonInstallCodeBlock({packageName}),
        ],
      },
      {
        type: StepType.CONFIGURE,
        content: [
          {
            type: 'text',
            text:
              featureFlagOptions.integration === FeatureFlagProviderEnum.GENERIC
                ? `You don't need an integration for a generic usecase. Simply use this API after initializing Sentry.`
                : tct('Add [name] to your integrations list.', {
                    name: <code>{`${integrationName}`}</code>,
                  }),
          },
          {
            type: 'code',
            language: 'python',
            code: makeConfigureCode(dsn.public),
          },
        ],
      },
      {
        type: StepType.VERIFY,
        content: [
          {
            type: 'text',
            text: t(
              'Test your setup by evaluating a flag, then capturing an exception. Check the Feature Flags table in Issue Details to confirm that your error event has recorded the flag and its result.'
            ),
          },
          {
            type: 'code',
            language: 'python',
            code: makeVerifyCode(),
          },
        ],
      },
    ];
  },
  verify: () => [],
  nextSteps: () => [],
};
