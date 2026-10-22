import {defined} from 'sentry/utils/defined';
import {useLocation} from 'sentry/utils/useLocation';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useParams} from 'sentry/utils/useParams';
import {usePrimaryNavigation} from 'sentry/views/navigation/primaryNavigationContext';
import {SettingsNavigation} from 'sentry/views/settings/components/settingsNavigation';
import {OrganizationSettingsNavigation} from 'sentry/views/settings/organization/organizationSettingsNavigation';
import {getUserNavigationConfiguration} from 'sentry/views/settings/organization/userOrgNavigationConfiguration';
import {ProjectSettingsNavigation} from 'sentry/views/settings/project/projectSettingsNavigation';
import {useSettingsV3} from 'sentry/views/settings/useSettingsV3';

export function SettingsSecondaryNavigation() {
  const params = useParams();
  const organization = useOrganization({allowNull: true});
  const location = useLocation();
  const settingsV3 = useSettingsV3();
  const {activeGroup} = usePrimaryNavigation();

  if (
    !organization ||
    (settingsV3 && location.pathname.startsWith('/settings/account/'))
  ) {
    return (
      <SettingsNavigation
        navigationObjects={getUserNavigationConfiguration()}
        hookConfigs={[]}
        hooks={[]}
      />
    );
  }

  // Show project settings when user is on /settings/:orgId/projects/:projectId
  if (activeGroup === 'settings' && defined(params.projectId)) {
    return <ProjectSettingsNavigation organization={organization} />;
  }

  if (settingsV3 && /^\/settings\/(?:[^/]+\/)?projects\/?$/.test(location.pathname)) {
    return <ProjectSettingsNavigation organization={organization} />;
  }

  return <OrganizationSettingsNavigation />;
}
