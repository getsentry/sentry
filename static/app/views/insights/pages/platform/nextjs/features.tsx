import type {Organization} from 'sentry/types/organization';
import {getSelectedProjectList} from 'sentry/utils/project/useSelectedProjectsHaveField';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import useProjects from 'sentry/utils/useProjects';

function hasNextJsInsightsFeature(organization: Organization) {
  return organization.features.includes('nextjs-insights');
}

export function useIsNextJsInsightsAvailable() {
  const organization = useOrganization();
  const {projects} = useProjects();
  const {selection} = usePageFilters();

  const selectedProjects = getSelectedProjectList(selection.projects, projects);

  const isOnlyNextJsSelected = selectedProjects.every(
    project => project.platform === 'javascript-nextjs'
  );

  return hasNextJsInsightsFeature(organization) && isOnlyNextJsSelected;
}
