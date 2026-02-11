import usePageFilters from 'sentry/components/pageFilters/usePageFilters';
import useProjects from 'sentry/utils/useProjects';

export default function useProjectHasSessions() {
  const {selection} = usePageFilters();
  const {projects: allProjects} = useProjects();

  const projectIds = selection.projects;

  const projects = projectIds.length
    ? projectIds
        .map(projectId => allProjects.find(p => p.id === projectId.toString()))
        .filter(project => project !== undefined)
    : allProjects;

  const hasSessionData = projects.some(p => p.hasSessions);

  return {projects, hasSessionData};
}
