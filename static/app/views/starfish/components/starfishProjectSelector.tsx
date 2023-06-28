import {CompactSelect} from 'sentry/components/compactSelect';
import ProjectBadge from 'sentry/components/idBadge/projectBadge';
import {Project} from 'sentry/types';
import usePageFilters from 'sentry/utils/usePageFilters';
import useProjects from 'sentry/utils/useProjects';

const ALLOWED_PLATFORMS = new Set(['python']);

export function StarfishProjectSelector() {
  const {projects} = useProjects();
  const {selection} = usePageFilters();

  const projectOptions = projects
    .filter(project => ALLOWED_PLATFORMS.has(project.platform ?? '') && project.isMember)
    .map(project => ({
      label: <ProjectOptionLabel project={project} />,
      value: project.id,
    }));

  const selectedOption = projectOptions.find(option =>
    selection.projects.includes(parseInt(option.value, 10))
  );

  return <CompactSelect options={projectOptions} defaultValue={selectedOption?.value} />;
}

function ProjectOptionLabel({project}: {project: Project}) {
  return <ProjectBadge project={project} avatarSize={20} disableLink />;
}
