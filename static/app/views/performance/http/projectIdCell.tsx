import ProjectBadge from 'sentry/components/idBadge/projectBadge';
import useProjects from 'sentry/utils/useProjects';

interface Props {
  domain?: string[];
  projectId?: string;
}

// TODO: Move this into `SPECIAL_FIELDS` and let the field renderer pipeline render it. To do so, we'll need `project` as an alias to `project.id` in the span metrics dataset.
export function ProjectIdCell({projectId}: Props) {
  const {projects} = useProjects();

  const project = projects.find(p => projectId === p.id);

  return project ? <ProjectBadge project={project} /> : projectId;
}
