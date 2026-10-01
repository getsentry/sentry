import {defined} from 'sentry/utils/defined';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useParams} from 'sentry/utils/useParams';
import {usePrimaryNavigation} from 'sentry/views/navigation/primaryNavigationContext';
import {SettingsNavigation} from 'sentry/views/settings/components/settingsNavigation';
import {OrganizationSettingsNavigation} from 'sentry/views/settings/organization/organizationSettingsNavigation';
import {getUserNavigationConfiguration} from 'sentry/views/settings/organization/userOrgNavigationConfiguration';
import {ProjectSettingsNavigation} from 'sentry/views/settings/project/projectSettingsNavigation';

export function SettingsSecondaryNavigation() {
  const params = useParams();
  const organization = useOrganization({allowNull: true});
  const {activeGroup} = usePrimaryNavigation();

  if (!organization) {
    return <SettingsNavigation navigationObjects={getUserNavigationConfiguration()} />;
  }

  // Show project settings when user is on /settings/:orgId/projects/:projectId
  if (activeGroup === 'settings' && defined(params.projectId)) {
    return <ProjectSettingsNavigation organization={organization} />;
  }

  return <OrganizationSettingsNavigation />;
}
