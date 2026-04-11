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
function getGenericConfig(packageName: `@sentry/${string}`): FeatureFlagConfiguration {
  return {
    makeConfigureCode: (dsn: string) => `import * as Sentry from "${packageName}";

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
}

function getFeatureFlagConfigurationMap(
  packageName: `@sentry/${string}`
): Record<FeatureFlagProviderEnum, FeatureFlagConfiguration> {
  const config = getGenericConfig(packageName);
  return {
    [FeatureFlagProviderEnum.GENERIC]: config,
    [FeatureFlagProviderEnum.LAUNCHDARKLY]: config,
    [FeatureFlagProviderEnum.OPENFEATURE]: config,
    [FeatureFlagProviderEnum.STATSIG]: config,
    [FeatureFlagProviderEnum.UNLEASH]: config,
  };
}

export const featureFlag = ({
  packageName = '@sentry/node',
}: {
  packageName?: `@sentry/${string}`;
} = {}): OnboardingConfig => ({
  install: () => [],
  configure: ({featureFlagOptions = {integration: ''}, dsn}) => {
    const configMap = getFeatureFlagConfigurationMap(packageName);
    const {makeConfigureCode, makeVerifyCode} =
      configMap[featureFlagOptions.integration as keyof typeof configMap];

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
                code: `npm install --save ${packageName}`,
              },
              {
                label: 'yarn',
                language: 'bash',
                code: `yarn add ${packageName}`,
              },
              {
                label: 'pnpm',
                language: 'bash',
                code: `pnpm add ${packageName}`,
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
});
