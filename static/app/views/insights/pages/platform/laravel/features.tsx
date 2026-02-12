import usePageFilters from 'sentry/components/pageFilters/usePageFilters';
import {getSelectedProjectList} from 'sentry/utils/project/useSelectedProjectsHaveField';
import useProjects from 'sentry/utils/useProjects';
import {useInsightsEap} from 'sentry/views/insights/common/utils/useEap';
import type {DomainView} from 'sentry/views/insights/pages/useFilters';
import {useDomainViewFilters} from 'sentry/views/insights/pages/useFilters';

const laravelViews: DomainView[] = ['backend'];

export function useIsLaravelInsightsAvailable() {
  const {projects} = useProjects();
  const {selection} = usePageFilters();
  const {view, isInOverviewPage} = useDomainViewFilters();
  const hasEap = useInsightsEap();

  const selectedProjects = getSelectedProjectList(selection.projects, projects);

  const isOnlyLaravelSelected = selectedProjects.every(
    project => project.platform === 'php-laravel'
  );

  return (
    hasEap &&
    isOnlyLaravelSelected &&
    view &&
    laravelViews.includes(view) &&
    isInOverviewPage
  );
}
