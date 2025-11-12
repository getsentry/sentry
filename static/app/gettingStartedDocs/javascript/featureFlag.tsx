import {SdkProviderEnum as FeatureFlagProviderEnum} from 'sentry/components/events/featureFlags/utils';
import type {OnboardingConfig} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {StepType} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {t, tct} from 'sentry/locale';

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
    integrationName: `featureFlagsIntegration`,
    packageName: '',
    makeConfigureCode: (dsn: string) => `import * as Sentry from "@sentry/browser";

Sentry.init({
  dsn: "${dsn}",
  integrations: [Sentry.featureFlagsIntegration()],
});`,
    makeVerifyCode:
      () => `const flagsIntegration = Sentry.getClient()?.getIntegrationByName<Sentry.FeatureFlagsIntegration>("FeatureFlags");
if (flagsIntegration) {
  flagsIntegration.addFeatureFlag("test-flag", false);
} else {
  // Something went wrong, check your DSN and/or integrations
}
Sentry.captureException(new Error("Something went wrong!"));`,
  },

  [FeatureFlagProviderEnum.LAUNCHDARKLY]: {
    integrationName: `launchDarklyIntegration`,
    packageName: 'launchdarkly-js-client-sdk',
    makeConfigureCode: (dsn: string) => `import * as Sentry from "@sentry/browser";
import * as LaunchDarkly from "launchdarkly-js-client-sdk";

Sentry.init({
  dsn: "${dsn}",
  integrations: [Sentry.launchDarklyIntegration()],
});

const ldClient = LaunchDarkly.initialize(
  "my-client-ID",
  { kind: "user", key: "my-user-context-key" },
  { inspectors: [Sentry.buildLaunchDarklyFlagUsedHandler()] },
);`,

    makeVerifyCode: () => `// You may have to wait for your client to initialize first.
ldClient?.variation("test-flag", false);
Sentry.captureException(new Error("Something went wrong!"));`,
  },

  [FeatureFlagProviderEnum.OPENFEATURE]: {
    integrationName: `openFeatureIntegration`,
    packageName: '@openfeature/web-sdk',
    makeConfigureCode: (dsn: string) => `import * as Sentry from "@sentry/browser";
import { OpenFeature } from "@openfeature/web-sdk";

Sentry.init({
  dsn: "${dsn}",
  integrations: [Sentry.openFeatureIntegration()],
});

OpenFeature.setProvider(new MyProviderOfChoice());
OpenFeature.addHooks(new Sentry.OpenFeatureIntegrationHook());`,

    makeVerifyCode: () => `const client = OpenFeature.getClient();
const result = client.getBooleanValue("test-flag", false);
Sentry.captureException(new Error("Something went wrong!"));`,
  },

  [FeatureFlagProviderEnum.STATSIG]: {
    integrationName: `statsigIntegration`,
    packageName: '@statsig/js-client',
    makeConfigureCode: (dsn: string) => `import * as Sentry from "@sentry/browser";
import { StatsigClient } from "@statsig/js-client";

const statsigClient = new StatsigClient(
  YOUR_SDK_KEY,
  { userID: "my-user-id" },
  {},
); // see Statsig SDK reference.

Sentry.init({
  dsn: "${dsn}",
  integrations: [
    Sentry.statsigIntegration({ featureFlagClient: statsigClient }),
  ],
});`,

    makeVerifyCode:
      () => `await statsigClient.initializeAsync(); // or statsigClient.initializeSync();

const result = statsigClient.checkGate("my-feature-gate");
Sentry.captureException(new Error("something went wrong"));`,
  },

  [FeatureFlagProviderEnum.UNLEASH]: {
    integrationName: `unleashIntegration`,
    packageName: 'unleash-proxy-client',
    makeConfigureCode: (dsn: string) => `import * as Sentry from "@sentry/browser";
import { UnleashClient } from "unleash-proxy-client";

Sentry.init({
  dsn: "${dsn}",
  integrations: [
    Sentry.unleashIntegration({ featureFlagClientClass: UnleashClient }),
  ],
});

const unleash = new UnleashClient({
  url: "https://<your-unleash-instance>/api/frontend",
  clientKey: "<your-client-side-token>",
  appName: "my-webapp",
});

unleash.start();`,

    makeVerifyCode: () => `// You may have to wait for your client to synchronize first.
unleash.isEnabled("test-flag");
Sentry.captureException(new Error("Something went wrong!"));`,
  },
};

export const featureFlag: OnboardingConfig = {
  install: () => [],
  configure: ({featureFlagOptions = {integration: ''}, dsn}) => {
    const {integrationName, makeConfigureCode, makeVerifyCode, packageName} =
      FEATURE_FLAG_CONFIGURATION_MAP[
        featureFlagOptions.integration as keyof typeof FEATURE_FLAG_CONFIGURATION_MAP
      ];

    return [
      {
        type: StepType.INSTALL,
        content: [
          {
            type: 'text',
            text: t('Install Sentry and the selected feature flag SDK.'),
          },
          {
            type: 'code',
            tabs: [
              {
                label: 'npm',
                language: 'bash',
                code: `npm install --save @sentry/browser ${packageName}`,
              },
              {
                label: 'yarn',
                language: 'bash',
                code: `yarn add @sentry/browser ${packageName}`,
              },
              {
                label: 'pnpm',
                language: 'bash',
                code: `pnpm add @sentry/browser ${packageName}`,
              },
            ],
          },
        ],
      },
      {
        type: StepType.CONFIGURE,
        content: [
          {
            type: 'text',
            text: tct(
              'Add [name] to your integrations list, and initialize your feature flag SDK.',
              {
                name: <code>{integrationName}</code>,
              }
            ),
          },
          {
            type: 'code',
            tabs: [
              {
                label: 'JavaScript',
                language: 'javascript',
                code: makeConfigureCode(dsn.public),
              },
            ],
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
            tabs: [
              {
                label: 'JavaScript',
                language: 'javascript',
                code: makeVerifyCode(),
              },
            ],
          },
        ],
      },
    ];
  },
  verify: () => [],
  nextSteps: () => [],
};
