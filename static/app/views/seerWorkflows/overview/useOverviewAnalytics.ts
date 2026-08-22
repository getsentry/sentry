import {useRouteAnalyticsEventNames} from 'sentry/utils/routeAnalytics/useRouteAnalyticsEventNames';
import {useRouteAnalyticsParams} from 'sentry/utils/routeAnalytics/useRouteAnalyticsParams';

import {type AutofixOverviewResponse, OVERVIEW_SECTIONS} from './types';

interface UseOverviewAnalyticsProps {
  isPending: boolean;
  numProjectsSelected: number;
  numUnconfiguredProjects: number;
  statsPeriod: string | null;
  data?: AutofixOverviewResponse;
}

// Fires the `autofix.overview.page_viewed` route-analytics event with adoption
// context. Counts come from the unfiltered milestone buckets, not the
// assignee/view-filtered sections, so they reflect the whole page.
export function useOverviewAnalytics({
  data,
  isPending,
  numProjectsSelected,
  numUnconfiguredProjects,
  statsPeriod,
}: UseOverviewAnalyticsProps) {
  useRouteAnalyticsEventNames(
    'autofix.overview.page_viewed',
    'Autofix Overview: Page Viewed'
  );

  const runsByMilestone = data?.runsByMilestone;
  const allRuns = runsByMilestone ? Object.values(runsByMilestone).flat() : [];
  const sectionCounts = OVERVIEW_SECTIONS.reduce<Record<string, number>>(
    (acc, {key, milestone}) => {
      acc[`runs_${key}`] = runsByMilestone?.[milestone]?.length ?? 0;
      return acc;
    },
    {}
  );

  useRouteAnalyticsParams(
    isPending
      ? {}
      : {
          num_runs: allRuns.length,
          ...sectionCounts,
          has_in_progress: allRuns.some(run => run.status === 'processing'),
          num_projects_selected: numProjectsSelected,
          num_unconfigured_projects: numUnconfiguredProjects,
          stats_period: statsPeriod,
        }
  );
}
