import {getOverride} from 'sentry/overrideRegistry';
import {ConfigStore} from 'sentry/stores/configStore';
import {useOrganization} from 'sentry/utils/useOrganization';
import {SettingsNavigation} from 'sentry/views/settings/components/settingsNavigation';
import {getUserOrgNavigationConfiguration} from 'sentry/views/settings/organization/userOrgNavigationConfiguration';
import {useSettingsV3} from 'sentry/views/settings/useSettingsV3';

function OrganizationSettingsNavigation() {
  const organization = useOrganization();
  const settingsV3 = useSettingsV3();
  const useBillingNavConfig =
    getOverride('react-hook:use-billing-navigation-config') ?? (() => null);
  const billingNavConfig = useBillingNavConfig(); // oxlint-disable-line react/hooks -- Hook comes from the override registry, which is populated before React renders.

  return (
    <SettingsNavigation
      navigationObjects={getUserOrgNavigationConfiguration().filter(
        // Settings V3 moves account settings to the primary Account entry,
        // so hide them here to avoid duplicating them in the Org sidebar.
        section => !settingsV3 || section.id !== 'settings-account'
      )}
      access={new Set(organization.access)}
      features={new Set(organization.features)}
      organization={organization}
      hookConfigs={billingNavConfig ? [billingNavConfig] : []}
      hooks={[]}
      isSelfHosted={ConfigStore.get('isSelfHosted')}
    />
  );
}

export {OrganizationSettingsNavigation};
