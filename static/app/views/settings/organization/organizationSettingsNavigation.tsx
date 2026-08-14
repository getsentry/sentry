import {useOrganizationSeerSetup} from 'sentry/components/events/autofix/useOrganizationSeerSetup';
import {getOverride} from 'sentry/overrideRegistry';
import {ConfigStore} from 'sentry/stores/configStore';
import {useOrganization} from 'sentry/utils/useOrganization';
import {SettingsNavigation} from 'sentry/views/settings/components/settingsNavigation';
import {getUserOrgNavigationConfiguration} from 'sentry/views/settings/organization/userOrgNavigationConfiguration';

function OrganizationSettingsNavigation() {
  const organization = useOrganization();
  const {hasFreeAutofixAccess} = useOrganizationSeerSetup();
  const useBillingNavConfig =
    getOverride('react-hook:use-billing-navigation-config') ?? (() => null);
  const billingNavConfig = useBillingNavConfig();

  return (
    <SettingsNavigation
      navigationObjects={getUserOrgNavigationConfiguration()}
      access={new Set(organization.access)}
      features={new Set(organization.features)}
      hasFreeAutofixAccess={hasFreeAutofixAccess}
      organization={organization}
      hookConfigs={billingNavConfig ? [billingNavConfig] : []}
      hooks={[]}
      isSelfHosted={ConfigStore.get('isSelfHosted')}
    />
  );
}

export {OrganizationSettingsNavigation};
