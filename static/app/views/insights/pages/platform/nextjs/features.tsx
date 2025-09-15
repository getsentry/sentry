import {getSelectedProjectList} from 'sentry/utils/project/useSelectedProjectsHaveField';
import usePageFilters from 'sentry/utils/usePageFilters';
import useProjects from 'sentry/utils/useProjects';
import {useDomainViewFilters} from 'sentry/views/insights/pages/useFilters';

export function useIsNextJsInsightsAvailable() {
  const {projects} = useProjects();
  const {selection} = usePageFilters();
  const {view} = useDomainViewFilters();

  const selectedProjects = getSelectedProjectList(selection.projects, projects);

  const isOnlyNextJsSelected = selectedProjects.every(
    project => project.platform === 'javascript-nextjs'
  );

  return isOnlyNextJsSelected && (view === 'frontend' || view === 'backend');
}
