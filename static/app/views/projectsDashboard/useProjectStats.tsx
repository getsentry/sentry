import {useCallback, useMemo} from 'react';

import {toast} from '@sentry/scraps/toast';

import {t} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';
import type {Project, ProjectStats} from 'sentry/types/project';
import type {ApiResponse} from 'sentry/utils/api/apiFetch';
import {apiOptions} from 'sentry/utils/api/apiOptions';
import {useAggregatedQueryKeys} from 'sentry/utils/api/useAggregatedQueryKeys';

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

function hasStats(stats: ProjectStatsData | undefined) {
  return stats?.stats !== undefined && stats.transactionStats !== undefined;
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
  organization: Organization;
}

export function useProjectStats({organization}: Props) {
  const projectStats = useAggregatedQueryKeys<
    string,
    ProjectStatsState,
    ProjectStatsResponse[]
  >({
    cacheKey: `project-dashboard-stats:${organization.slug}:transaction-stats`,
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
              transactionStats: '1',
              sessionStats: '1',
            },
            staleTime: 0,
          }
        ),
      [organization.slug]
    ),
    onError: useCallback(() => {
      toast.error(t('Unable to fetch all project stats'));
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
          if (aggregateIds.has(statsProject.id) && hasStats(statsProject)) {
            nextState[statsProject.id] = getStatsData(statsProject);
          }
        }

        return nextState;
      },
      []
    ),
  });

  const getOne = useCallback(
    (project: Project): ProjectStatsData => {
      const initialStats = getStatsData(project);
      const cachedStats = projectStats.read([project.id])?.[project.id];

      if (cachedStats && hasStats(cachedStats)) {
        return cachedStats;
      }

      if (!hasStats(initialStats)) {
        projectStats.buffer([project.id]);
      }

      return projectStats.data?.[project.id] ?? initialStats;
    },
    [projectStats]
  );

  return useMemo(() => ({getOne}), [getOne]);
}
