import {useMemo} from 'react';

import {ALL_ACCESS_PROJECTS} from 'sentry/components/pageFilters/constants';
import {usePageFilters} from 'sentry/components/pageFilters/usePageFilters';
import type {Organization} from 'sentry/types/organization';
import {useProjects} from 'sentry/utils/useProjects';
import {canUseMetricsUI} from 'sentry/views/explore/metrics/metricsFlags';
import type {CrossEventType} from 'sentry/views/explore/queryParams/crossEvent';

export type CrossEventDatasetAvailability = Record<CrossEventType, boolean>;

export function useCrossEventDatasetAvailability(
  organization: Organization
): CrossEventDatasetAvailability {
  const {projects} = useProjects();
  const {selection} = usePageFilters();
  const canUseMetrics = canUseMetricsUI(organization);

  return useMemo(() => {
    const explicitlySelectedProjectIds = selection.projects.filter(
      projectId => projectId !== ALL_ACCESS_PROJECTS && projectId > 0
    );

    const selectedProjects =
      explicitlySelectedProjectIds.length > 0
        ? projects.filter(project =>
            explicitlySelectedProjectIds.includes(Number(project.id))
          )
        : projects;

    return {
      spans: true,
      logs: selectedProjects.some(project => project.hasLogs),
      metrics: canUseMetrics && selectedProjects.some(project => project.hasTraceMetrics),
    };
  }, [canUseMetrics, projects, selection.projects]);
}
