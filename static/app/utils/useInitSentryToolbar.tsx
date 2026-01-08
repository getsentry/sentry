import type {FeatureFlagAdapter} from '@sentry/toolbar';
import {useSentryToolbar} from '@sentry/toolbar';

import ConfigStore from 'sentry/stores/configStore';
import {useLegacyStore} from 'sentry/stores/useLegacyStore';
import type {Organization} from 'sentry/types/organization';
import FeatureFlagOverrides from 'sentry/utils/featureFlagOverrides';
import {useIsSentryEmployee} from 'sentry/utils/useIsSentryEmployee';

export default function useInitSentryToolbar(organization: null | Organization) {
  const isEnvEnabled = !!process.env.ENABLE_SENTRY_TOOLBAR;
  const showDevToolbar =
    !!organization && !!organization.features.includes('init-sentry-toolbar');
  const isEmployee = useIsSentryEmployee();
  const config = useLegacyStore(ConfigStore);

  useSentryToolbar({
    enabled: showDevToolbar && isEmployee && isEnvEnabled,
    version: '1.0.0-beta.22',
    initProps: {
      organizationSlug: organization?.slug ?? 'sentry',
      projectIdOrSlug: 'javascript',
      environment: 'prod',
      theme: config.theme,
      featureFlags: organization ? getFlagpoleAdapter(organization) : undefined,
    },
  });
}

const getFlagpoleAdapter = (organization: Organization): FeatureFlagAdapter => ({
  /**
   * All known flag names and their evaluated values.
   */
  getFlagMap: () => FeatureFlagOverrides.singleton().getFlagMap(organization),

  /**
   * Any overridden or manually set flags and values.
   */
  getOverrides: () => FeatureFlagOverrides.singleton().getStoredOverrides(),

  /**
   * Manually set a flag to be a specific value, overriding the evaluated value.
   */
  setOverride: (name, value) => {
    // only boolean flags in sentry
    if (typeof value === 'boolean') {
      FeatureFlagOverrides.singleton().setStoredOverride(name, value);
    }
  },

  /**
   * A callback to clear all overrides from this browser.
   */
  clearOverrides: () => FeatureFlagOverrides.singleton().clear(),

  /**
   * Deeplink into your external feature-flag provider and find out more about
   * this specific flag.
   */
  urlTemplate: flag =>
    `https://github.com/search?q=repo%3Agetsentry%2Fsentry-options-automator+OR+repo%3Agetsentry%2Fsentry+${flag}&type=code`,
});
