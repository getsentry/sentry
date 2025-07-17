import {getSelectedProjectList} from 'sentry/utils/project/useSelectedProjectsHaveField';
import usePageFilters from 'sentry/utils/usePageFilters';
import useProjects from 'sentry/utils/useProjects';
import type {DomainView} from 'sentry/views/insights/pages/useFilters';
import {useDomainViewFilters} from 'sentry/views/insights/pages/useFilters';

const laravelViews: DomainView[] = ['backend'];

export function useIsLaravelInsightsAvailable() {
  const {projects} = useProjects();
  const {selection} = usePageFilters();
  const {view, isInOverviewPage} = useDomainViewFilters();

  const selectedProjects = getSelectedProjectList(selection.projects, projects);

  const isOnlyLaravelSelected = selectedProjects.every(
    project => project.platform === 'php-laravel'
  );

  return isOnlyLaravelSelected && view && laravelViews.includes(view) && isInOverviewPage;
}
