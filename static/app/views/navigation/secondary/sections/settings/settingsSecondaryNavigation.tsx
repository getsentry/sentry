import {defined} from 'sentry/utils';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useParams} from 'sentry/utils/useParams';
import {usePrimaryNavigation} from 'sentry/views/navigation/primaryNavigationContext';
import OrganizationSettingsNavigation from 'sentry/views/settings/organization/organizationSettingsNavigation';
import ProjectSettingsNavigation from 'sentry/views/settings/project/projectSettingsNavigation';

export function SettingsSecondaryNavigation() {
  const params = useParams();
  const organization = useOrganization();
  const {activeGroup} = usePrimaryNavigation();

  // Show project settings when user is on /settings/:orgId/projects/:projectId
  if (activeGroup === 'settings' && defined(params.projectId)) {
    return <ProjectSettingsNavigation organization={organization} />;
  }

  return <OrganizationSettingsNavigation organization={organization} />;
}
