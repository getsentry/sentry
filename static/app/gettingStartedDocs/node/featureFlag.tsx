import {SdkProviderEnum as FeatureFlagProviderEnum} from 'sentry/components/events/featureFlags/utils';
import type {OnboardingConfig} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {StepType} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {t} from 'sentry/locale';

type FeatureFlagConfiguration = {
  makeConfigureCode: (dsn: string) => string;
  makeVerifyCode: () => string;
};

// Node.js only supports the generic featureFlagsIntegration. Vendor-specific
// integrations (LaunchDarkly, OpenFeature, etc.) are browser-only in @sentry/browser.
// All providers therefore use the same generic setup.
const genericConfig: FeatureFlagConfiguration = {
  makeConfigureCode: (dsn: string) => `import * as Sentry from "@sentry/node";

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
};

const FEATURE_FLAG_CONFIGURATION_MAP: Record<
  FeatureFlagProviderEnum,
  FeatureFlagConfiguration
> = {
  [FeatureFlagProviderEnum.GENERIC]: genericConfig,
  [FeatureFlagProviderEnum.LAUNCHDARKLY]: genericConfig,
  [FeatureFlagProviderEnum.OPENFEATURE]: genericConfig,
  [FeatureFlagProviderEnum.STATSIG]: genericConfig,
  [FeatureFlagProviderEnum.UNLEASH]: genericConfig,
};

export const featureFlag: OnboardingConfig = {
  install: () => [],
  configure: ({featureFlagOptions = {integration: ''}, dsn}) => {
    const {makeConfigureCode, makeVerifyCode} =
      FEATURE_FLAG_CONFIGURATION_MAP[
        featureFlagOptions.integration as keyof typeof FEATURE_FLAG_CONFIGURATION_MAP
      ];

    return [
      {
        type: StepType.INSTALL,
        content: [
          {
            type: 'text',
            text: t('Install the Sentry SDK.'),
          },
          {
            type: 'code',
            tabs: [
              {
                label: 'npm',
                language: 'bash',
                code: 'npm install --save @sentry/node',
              },
              {
                label: 'yarn',
                language: 'bash',
                code: 'yarn add @sentry/node',
              },
              {
                label: 'pnpm',
                language: 'bash',
                code: 'pnpm add @sentry/node',
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
            text: t(
              'Add featureFlagsIntegration to your integrations list, and use the addFeatureFlag API to record evaluations.'
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
