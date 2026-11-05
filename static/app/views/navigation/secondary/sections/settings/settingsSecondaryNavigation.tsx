import {useOrganization} from 'sentry/utils/useOrganization';
import {SettingsNavigation} from 'sentry/views/settings/components/settingsNavigation';
import {OrganizationSettingsNavigation} from 'sentry/views/settings/organization/organizationSettingsNavigation';
import {getUserNavigationConfiguration} from 'sentry/views/settings/organization/userOrgNavigationConfiguration';
import {ProjectSettingsNavigation} from 'sentry/views/settings/project/projectSettingsNavigation';
import {useSettingsScope} from 'sentry/views/settings/useSettingsScope';
import {useSettingsV3} from 'sentry/views/settings/useSettingsV3';

export function SettingsSecondaryNavigation() {
  const organization = useOrganization({allowNull: true});
  const {scope} = useSettingsScope();
  const settingsV3 = useSettingsV3();

  if (!organization || (settingsV3 && scope === 'account')) {
    return (
      <SettingsNavigation
        navigationObjects={getUserNavigationConfiguration({settingsV3})}
        hookConfigs={[]}
        hooks={[]}
      />
    );
  }

  // Show project settings when user is on /settings/:orgId/projects/:projectId
  if (scope === 'project') {
    return <ProjectSettingsNavigation organization={organization} />;
  }

  return <OrganizationSettingsNavigation />;
}
