import type {Organization} from 'sentry/types/organization';
import {getSelectedProjectList} from 'sentry/utils/project/useSelectedProjectsHaveField';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import useProjects from 'sentry/utils/useProjects';

function hasLaravelInsightsFeature(organization: Organization) {
  return organization.features.includes('laravel-insights');
}

export function useIsLaravelInsightsAvailable() {
  const organization = useOrganization();
  const {projects} = useProjects();
  const {selection} = usePageFilters();

  const selectedProjects = getSelectedProjectList(selection.projects, projects);

  const isOnlyLaravelSelected = selectedProjects.every(
    project => project.platform === 'php-laravel'
  );

  return hasLaravelInsightsFeature(organization) && isOnlyLaravelSelected;
}
