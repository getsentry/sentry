import {defined} from 'sentry/utils';
import useOrganization from 'sentry/utils/useOrganization';
import {useParams} from 'sentry/utils/useParams';
import {PrimaryNavigationGroup} from 'sentry/views/navigation/types';
import {useActiveNavigationGroup} from 'sentry/views/navigation/useActiveNavigationGroup';
import OrganizationSettingsNavigation from 'sentry/views/settings/organization/organizationSettingsNavigation';
import ProjectSettingsNavigation from 'sentry/views/settings/project/projectSettingsNavigation';

export function SettingsSecondaryNavigation() {
  const organization = useOrganization();
  const params = useParams();
  const activeNavigationGroup = useActiveNavigationGroup();
  const isProjectSettings =
    defined(params.projectId) &&
    activeNavigationGroup === PrimaryNavigationGroup.SETTINGS;

  return isProjectSettings ? (
    <ProjectSettingsNavigation organization={organization} />
  ) : (
    <OrganizationSettingsNavigation organization={organization} />
  );
}
