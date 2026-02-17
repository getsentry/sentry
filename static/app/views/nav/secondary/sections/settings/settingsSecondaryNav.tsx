import useOrganization from 'sentry/utils/useOrganization';
import {useParams} from 'sentry/utils/useParams';
import useProjects from 'sentry/utils/useProjects';
import OrganizationSettingsNavigation from 'sentry/views/settings/organization/organizationSettingsNavigation';

export function SettingsSecondaryNav() {
  const organization = useOrganization();
  const params = useParams<{projectId?: string}>();
  const {projects} = useProjects();
  const project = projects.find(p => p.slug === params.projectId);

  return <OrganizationSettingsNavigation organization={organization} project={project} />;
}
