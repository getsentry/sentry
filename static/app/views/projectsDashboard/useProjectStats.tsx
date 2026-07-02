import {useCallback, useMemo} from 'react';

import {addErrorMessage} from 'sentry/actionCreators/indicator';
import {t} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';
import type {Project, ProjectStats} from 'sentry/types/project';
import type {ApiResponse} from 'sentry/utils/api/apiFetch';
import {apiOptions} from 'sentry/utils/api/apiOptions';
import {useAggregatedQueryKeys} from 'sentry/utils/api/useAggregatedQueryKeys';
import {DiscoverDatasets} from 'sentry/utils/discover/types';

const MAX_PROJECTS_TO_FETCH = 10;

type ProjectSessionStats = {
  currentCrashFreeRate: number | null;
  hasHealthData: boolean;
  previousCrashFreeRate: number | null;
};

type ProjectStatsData = {
  latestDeploys?: Project['latestDeploys'];
  sessionStats?: ProjectSessionStats;
  stats?: ProjectStats;
  transactionStats?: ProjectStats;
};

type ProjectStatsResponse = Project & ProjectStatsData;
type ProjectStatsState = Record<string, ProjectStatsData>;

function hasStats(stats: ProjectStatsData | undefined, hasPerformance: boolean) {
  return (
    stats?.stats !== undefined &&
    (!hasPerformance || stats.transactionStats !== undefined)
  );
}

function getStatsData(project: ProjectStatsResponse): ProjectStatsData {
  return {
    latestDeploys: project.latestDeploys,
    sessionStats: project.sessionStats,
    stats: project.stats,
    transactionStats: project.transactionStats,
  };
}

interface Props {
  hasPerformance: boolean;
  organization: Organization;
}

export function useProjectStats({hasPerformance, organization}: Props) {
  const projectStats = useAggregatedQueryKeys<
    string,
    ProjectStatsState,
    ProjectStatsResponse[]
  >({
    cacheKey: `project-dashboard-stats:${organization.slug}:transaction-stats:${hasPerformance}`,
    bufferLimit: MAX_PROJECTS_TO_FETCH,
    getQueryOptions: useCallback(
      ids =>
        apiOptions.as<ProjectStatsResponse[]>()(
          '/organizations/$organizationIdOrSlug/projects/',
          {
            path: {organizationIdOrSlug: organization.slug},
            query: {
              statsPeriod: '24h',
              query: ids.map(id => `id:${id}`).join(' '),
              transactionStats: hasPerformance ? '1' : undefined,
              dataset: DiscoverDatasets.METRICS_ENHANCED,
              sessionStats: '1',
            },
            staleTime: 0,
          }
        ),
      [hasPerformance, organization.slug]
    ),
    onError: useCallback(() => {
      addErrorMessage(t('Unable to fetch all project stats'));
    }, []),
    responseReducer: useCallback(
      (
        prevState: ProjectStatsState | undefined,
        response: ApiResponse<ProjectStatsResponse[]>,
        aggregates: readonly string[]
      ) => {
        const aggregateIds = new Set(aggregates);
        const nextState: ProjectStatsState = Object.fromEntries(
          Object.entries(prevState ?? {}).filter(([projectId]) =>
            aggregateIds.has(projectId)
          )
        );

        for (const statsProject of response.json) {
          if (
            aggregateIds.has(statsProject.id) &&
            hasStats(statsProject, hasPerformance)
          ) {
            nextState[statsProject.id] = getStatsData(statsProject);
          }
        }

        return nextState;
      },
      [hasPerformance]
    ),
  });

  const getOne = useCallback(
    (project: Project): ProjectStatsData => {
      const initialStats = getStatsData(project);
      const cachedStats = projectStats.read([project.id])?.[project.id];

      if (cachedStats && hasStats(cachedStats, hasPerformance)) {
        return cachedStats;
      }

      if (!hasStats(initialStats, hasPerformance)) {
        projectStats.buffer([project.id]);
      }

      return projectStats.data?.[project.id] ?? initialStats;
    },
    [hasPerformance, projectStats]
  );

  return useMemo(() => ({getOne}), [getOne]);
}
