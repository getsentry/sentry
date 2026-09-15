import {useProjects} from 'sentry/utils/useProjects';

export function useDetectorProject(projectId: string) {
  const {projects} = useProjects();
  const project = projects.find(candidate => candidate.id === projectId);
  if (!project) {
    throw new Error('The selected monitor project could not be found');
  }
  return project;
}
