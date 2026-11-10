import {getOverride} from 'sentry/overrideRegistry';
import {ConfigStore} from 'sentry/stores/configStore';
import {useOrganization} from 'sentry/utils/useOrganization';
import {SettingsNavigation} from 'sentry/views/settings/components/settingsNavigation';
import {useSettingsV3} from 'sentry/views/settings/useSettingsV3';

import {getUserOrgNavigationConfiguration} from './userOrgNavigationConfiguration';

function OrganizationSettingsNavigation() {
  const organization = useOrganization();
  const settingsV3 = useSettingsV3();
  const useBillingNavConfig =
    getOverride('react-hook:use-billing-navigation-config') ?? (() => null);
  const billingNavConfig = useBillingNavConfig(); // oxlint-disable-line react/hooks -- Hook comes from the override registry, which is populated before React renders.

  return (
    <SettingsNavigation
      navigationObjects={getUserOrgNavigationConfiguration({settingsV3})}
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
