import {defined} from 'sentry/utils';
import useOrganization from 'sentry/utils/useOrganization';
import {useParams} from 'sentry/utils/useParams';
import {PrimaryNavGroup} from 'sentry/views/nav/types';
import {useActiveNavGroup} from 'sentry/views/nav/useActiveNavGroup';
import OrganizationSettingsNavigation from 'sentry/views/settings/organization/organizationSettingsNavigation';
import ProjectSettingsNavigation from 'sentry/views/settings/project/projectSettingsNavigation';

export function SettingsSecondaryNav() {
  const organization = useOrganization();
  const params = useParams();
  const activeNavGroup = useActiveNavGroup();
  const isProjectSettings =
    defined(params.projectId) && activeNavGroup === PrimaryNavGroup.SETTINGS;

  return isProjectSettings ? (
    <ProjectSettingsNavigation organization={organization} />
  ) : (
    <OrganizationSettingsNavigation organization={organization} />
  );
}
