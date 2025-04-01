import {defined} from 'sentry/utils';
import useOrganization from 'sentry/utils/useOrganization';
import {useParams} from 'sentry/utils/useParams';
import OrganizationSettingsNavigation from 'sentry/views/settings/organization/organizationSettingsNavigation';
import ProjectSettingsNavigation from 'sentry/views/settings/project/projectSettingsNavigation';

export function SettingsSecondaryNav() {
  const organization = useOrganization();
  const params = useParams();

  const isProjectSettings = defined(params.projectId);

  return isProjectSettings ? (
    <ProjectSettingsNavigation organization={organization} />
  ) : (
    <OrganizationSettingsNavigation organization={organization} />
  );
}
