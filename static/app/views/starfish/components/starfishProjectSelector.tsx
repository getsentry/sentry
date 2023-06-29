import {updateProjects} from 'sentry/actionCreators/pageFilters';
import {CompactSelect} from 'sentry/components/compactSelect';
import ProjectBadge from 'sentry/components/idBadge/projectBadge';
import {Project} from 'sentry/types';
import usePageFilters from 'sentry/utils/usePageFilters';
import useProjects from 'sentry/utils/useProjects';
import useRouter from 'sentry/utils/useRouter';

const ALLOWED_PLATFORMS = new Set(['python']);

export function StarfishProjectSelector() {
  const {projects} = useProjects();
  const {selection} = usePageFilters();
  const router = useRouter();

  const projectOptions = projects
    .filter(project => ALLOWED_PLATFORMS.has(project.platform ?? '') && project.isMember)
    .map(project => ({
      label: <ProjectOptionLabel project={project} />,
      value: project.id,
    }));

  const selectedOption = projectOptions.find(option =>
    selection.projects.includes(parseInt(option.value, 10))
  );

  const handleProjectChange = option =>
    updateProjects([parseInt(option.value, 10)], router);

  return (
    <CompactSelect
      options={projectOptions}
      defaultValue={selectedOption?.value}
      onChange={handleProjectChange}
    />
  );
}

function ProjectOptionLabel({project}: {project: Project}) {
  return <ProjectBadge project={project} avatarSize={20} disableLink />;
}
