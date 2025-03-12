import {useMemo} from 'react';

import {type Fidelity, getInterval} from 'sentry/components/charts/utils';
import {normalizeDateTimeParams} from 'sentry/components/organizations/pageFilters/parse';
import type {Project} from 'sentry/types/project';
import {getSelectedProjectList} from 'sentry/utils/project/useSelectedProjectsHaveField';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import useProjects from 'sentry/utils/useProjects';
import {hasLaravelInsightsFeature} from 'sentry/views/insights/pages/backend/laravel/features';
import {useLaravelInsightsContext} from 'sentry/views/insights/pages/backend/laravel/laravelInsightsContext';

export function usePageFilterChartParams({
  granularity = 'spans',
}: {
  granularity?: Fidelity;
} = {}) {
  const {selection} = usePageFilters();

  const normalizedDateTime = useMemo(
    () => normalizeDateTimeParams(selection.datetime),
    [selection.datetime]
  );

  return {
    ...normalizedDateTime,
    interval: getInterval(selection.datetime, granularity),
    project: selection.projects,
  };
}

export function useIsLaravelSelected() {
  const {projects} = useProjects();
  const {selection} = usePageFilters();

  const selectedProjects: Project[] = useMemo(
    () => getSelectedProjectList(selection.projects, projects),
    [projects, selection.projects]
  );

  const selectedProject = selectedProjects.length === 1 ? selectedProjects[0] : null;
  return selectedProject?.platform === 'php-laravel';
}

export function useIsLaravelPageActive() {
  const organization = useOrganization();
  const isLaravelSelected = useIsLaravelSelected();
  const {isLaravelInsightsEnabled} = useLaravelInsightsContext();

  return (
    isLaravelSelected &&
    isLaravelInsightsEnabled &&
    hasLaravelInsightsFeature(organization)
  );
}
