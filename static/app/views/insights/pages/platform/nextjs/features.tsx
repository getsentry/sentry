import usePageFilters from 'sentry/components/pageFilters/usePageFilters';
import {getSelectedProjectList} from 'sentry/utils/project/useSelectedProjectsHaveField';
import useProjects from 'sentry/utils/useProjects';
import {useInsightsEap} from 'sentry/views/insights/common/utils/useEap';
import {useDomainViewFilters} from 'sentry/views/insights/pages/useFilters';

export function useIsNextJsInsightsAvailable() {
  const {projects} = useProjects();
  const {selection} = usePageFilters();
  const {view} = useDomainViewFilters();
  const hasEap = useInsightsEap();

  const selectedProjects = getSelectedProjectList(selection.projects, projects);

  const isOnlyNextJsSelected = selectedProjects.every(
    project => project.platform === 'javascript-nextjs'
  );

  return hasEap && isOnlyNextJsSelected && (view === 'frontend' || view === 'backend');
}
