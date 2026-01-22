import {useCallback, useMemo} from 'react';
import {useQueries} from '@tanstack/react-query';
import chunk from 'lodash/chunk';

import type {ApiResult} from 'sentry/api';
import {normalizeDateTimeParams} from 'sentry/components/organizations/pageFilters/parse';
import {GroupSubstatus} from 'sentry/types/group';
import type {Group} from 'sentry/types/group';
import {
  fetchDataQuery,
  useApiQuery,
  type ApiQueryKey,
  type UseQueryResult,
} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';

import type {ClusterSummary} from './topIssuesDrawer';

const GROUPS_PER_QUERY = 100;

export interface ClusterStats {
  firstSeen: string | null;
  hasRegressedIssues: boolean;
  isEscalating: boolean;
  isPending: boolean;
  lastSeen: string | null;
  newIssuesCount: number;
  totalEvents: number;
  totalUsers: number;
}

export const PENDING_CLUSTER_STATS: ClusterStats = {
  totalEvents: 0,
  totalUsers: 0,
  firstSeen: null,
  lastSeen: null,
  newIssuesCount: 0,
  hasRegressedIssues: false,
  isEscalating: false,
  isPending: true,
};

function getClusterStatsFromGroups(
  groups: Group[] | undefined,
  isPending: boolean
): ClusterStats {
  if (isPending) {
    return PENDING_CLUSTER_STATS;
  }

  if (!groups || groups.length === 0) {
    return {
      totalEvents: 0,
      totalUsers: 0,
      firstSeen: null,
      lastSeen: null,
      newIssuesCount: 0,
      hasRegressedIssues: false,
      isEscalating: false,
      isPending: false,
    };
  }

  let totalEvents = 0;
  let totalUsers = 0;
  let earliestFirstSeen: Date | null = null;
  let latestLastSeen: Date | null = null;

  const oneWeekAgo = new Date();
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
  let newIssuesCount = 0;

  let hasRegressedIssues = false;

  let firstHalfEvents = 0;
  let secondHalfEvents = 0;

  for (const group of groups) {
    totalEvents += parseInt(group.count, 10) || 0;
    totalUsers += group.userCount || 0;

    if (group.firstSeen) {
      const firstSeenDate = new Date(group.firstSeen);
      if (!earliestFirstSeen || firstSeenDate < earliestFirstSeen) {
        earliestFirstSeen = firstSeenDate;
      }
      if (firstSeenDate >= oneWeekAgo) {
        newIssuesCount++;
      }
    }

    if (group.lastSeen) {
      const lastSeenDate = new Date(group.lastSeen);
      if (!latestLastSeen || lastSeenDate > latestLastSeen) {
        latestLastSeen = lastSeenDate;
      }
    }

    if (group.substatus === GroupSubstatus.REGRESSED) {
      hasRegressedIssues = true;
    }

    const stats24h = group.stats?.['24h'];
    if (stats24h && stats24h.length > 0) {
      const midpoint = Math.floor(stats24h.length / 2);
      for (let i = 0; i < stats24h.length; i++) {
        const eventCount = stats24h[i]?.[1] ?? 0;
        if (i < midpoint) {
          firstHalfEvents += eventCount;
        } else {
          secondHalfEvents += eventCount;
        }
      }
    }
  }

  const isEscalating = firstHalfEvents > 0 && secondHalfEvents > firstHalfEvents * 1.5;

  return {
    totalEvents,
    totalUsers,
    firstSeen: earliestFirstSeen?.toISOString() ?? null,
    lastSeen: latestLastSeen?.toISOString() ?? null,
    newIssuesCount,
    hasRegressedIssues,
    isEscalating,
    isPending,
  };
}

export function useClusterStatsMap(clusters: ClusterSummary[]) {
  const organization = useOrganization();
  const {selection} = usePageFilters();

  const queryKeys = useMemo(() => {
    const groupIds = Array.from(new Set(clusters.flatMap(cluster => cluster.group_ids)));
    const queryChunks = chunk(groupIds, GROUPS_PER_QUERY);

    return queryChunks.map(
      (groupIdsChunk): ApiQueryKey => [
        `/organizations/${organization.slug}/issues/`,
        {
          query: {
            group: groupIdsChunk,
            query: `issue.id:[${groupIdsChunk.join(',')}]`,
            project: selection.projects,
            environment: selection.environments,
            ...normalizeDateTimeParams(selection.datetime),
          },
        },
      ]
    );
  }, [
    organization.slug,
    clusters,
    selection.datetime,
    selection.environments,
    selection.projects,
  ]);

  const combineResults = useCallback(
    (results: Array<UseQueryResult<ApiResult<Group[]>, Error>>) => {
      const pending = results.some(result => result.isPending);
      const groups = new Map<number, Group>();

      if (!pending) {
        results.forEach(result => {
          // result.data is ApiResult<Group[]> which is [Group[], string, ResponseMeta]
          const groupData = result.data?.[0];
          groupData?.forEach(group => {
            const groupId = Number(group.id);
            if (!Number.isNaN(groupId)) {
              groups.set(groupId, group);
            }
          });
        });
      }

      const statsById = new Map<number, ClusterStats>();

      for (const cluster of clusters) {
        if (pending) {
          statsById.set(cluster.cluster_id, PENDING_CLUSTER_STATS);
          continue;
        }

        const clusterGroups = cluster.group_ids
          .map(groupId => groups.get(groupId))
          .filter(Boolean) as Group[];

        statsById.set(
          cluster.cluster_id,
          getClusterStatsFromGroups(clusterGroups, false)
        );
      }

      return {clusterStatsById: statsById};
    },
    [clusters]
  );

  return useQueries({
    queries: queryKeys.map(queryKey => ({
      queryKey,
      queryFn: fetchDataQuery<Group[]>,
      staleTime: 60000,
      enabled: queryKeys.length > 0,
    })),
    combine: combineResults,
  });
}

export function useClusterStats(groupIds: number[]): ClusterStats {
  const organization = useOrganization();

  const {data: groups, isPending} = useApiQuery<Group[]>(
    [
      `/organizations/${organization.slug}/issues/`,
      {
        query: {
          group: groupIds,
          query: `issue.id:[${groupIds.join(',')}]`,
        },
      },
    ],
    {
      staleTime: 60000,
      enabled: groupIds.length > 0,
    }
  );

  return useMemo(() => getClusterStatsFromGroups(groups, isPending), [groups, isPending]);
}
