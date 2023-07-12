import {updateProjects} from 'sentry/actionCreators/pageFilters';
import {CompactSelect} from 'sentry/components/compactSelect';
import ProjectBadge from 'sentry/components/idBadge/projectBadge';
import {Project} from 'sentry/types';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import useProjects from 'sentry/utils/useProjects';
import useRouter from 'sentry/utils/useRouter';
import {ALLOWED_PROJECT_IDS_FOR_ORG_SLUG} from 'sentry/views/starfish/allowedProjects';

export function StarfishProjectSelector() {
  const {projects} = useProjects();
  const organization = useOrganization();
  const {selection} = usePageFilters();
  const router = useRouter();

  const allowedProjectIDs: string[] =
    ALLOWED_PROJECT_IDS_FOR_ORG_SLUG[organization.slug] ?? [];

  const projectOptions = projects
    .filter(project => allowedProjectIDs.includes(project.id))
    .map(project => ({
      label: <ProjectOptionLabel project={project} />,
      value: project.id,
    }));

  const selectedOption =
    projectOptions.find(option =>
      selection.projects.includes(parseInt(option.value, 10))
    ) ?? projectOptions[0];

  const handleProjectChange = option =>
    updateProjects([parseInt(option.value, 10)], router, {save: true});

  if (
    selection.projects.length > 1 ||
    !allowedProjectIDs.includes(`${selection.projects[0]}`)
  ) {
    handleProjectChange(projectOptions[0]);
  }

  return (
    <CompactSelect
      menuWidth={250}
      options={projectOptions}
      defaultValue={selectedOption?.value}
      onChange={handleProjectChange}
    />
  );
}

function ProjectOptionLabel({project}: {project: Project}) {
  return <ProjectBadge project={project} avatarSize={20} disableLink />;
}
