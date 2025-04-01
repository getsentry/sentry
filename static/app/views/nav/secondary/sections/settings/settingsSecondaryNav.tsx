import useOrganization from 'sentry/utils/useOrganization';
import OrganizationSettingsNavigation from 'sentry/views/settings/organization/organizationSettingsNavigation';

export function SettingsSecondaryNav() {
  const organization = useOrganization();

  return <OrganizationSettingsNavigation organization={organization} />;
}
