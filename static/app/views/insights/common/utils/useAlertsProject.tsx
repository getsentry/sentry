import usePageFilters from 'sentry/utils/usePageFilters';
import useProjects from 'sentry/utils/useProjects';

/**
 * Alerts only support one project at a time, so we need to determine which project to use
 * @returns
 */
export function useAlertsProject() {
  const {projects} = useProjects();
  const {selection} = usePageFilters();

  const project =
    projects.length === 1
      ? projects[0]
      : projects.find(p => p.id === `${selection.projects[0]}`);

  return project;
}
