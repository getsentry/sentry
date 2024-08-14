import useProjects from 'sentry/utils/useProjects';

interface Props {
  project_id: string | undefined;
}

export default function useProjectFromId({project_id}: Props) {
  const {projects} = useProjects();
  if (project_id) {
    return projects.find(p => p.id === project_id) ?? undefined;
  }
  return undefined;
}
