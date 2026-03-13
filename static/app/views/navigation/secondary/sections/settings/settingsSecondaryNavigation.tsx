import {defined} from 'sentry/utils';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useParams} from 'sentry/utils/useParams';
import {useNavigation} from 'sentry/views/navigation/navigationContext';
import OrganizationSettingsNavigation from 'sentry/views/settings/organization/organizationSettingsNavigation';
import ProjectSettingsNavigation from 'sentry/views/settings/project/projectSettingsNavigation';

export function SettingsSecondaryNavigation() {
  const organization = useOrganization();
  const params = useParams();
  const {activeGroup} = useNavigation();
  const isProjectSettings = defined(params.projectId) && activeGroup === 'settings';

  return isProjectSettings ? (
    <ProjectSettingsNavigation organization={organization} />
  ) : (
    <OrganizationSettingsNavigation organization={organization} />
  );
}
