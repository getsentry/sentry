import {
  getSortedClusterIds,
  type ClusterSortInput,
} from 'sentry/views/issueList/dynamicGrouping/clusterSorting';
import type {ClusterStats} from 'sentry/views/issueList/dynamicGrouping/clusterStats';

const defaultStats: ClusterStats = {
  totalEvents: 0,
  totalUsers: 0,
  firstSeen: null,
  lastSeen: null,
  newIssuesCount: 0,
  hasRegressedIssues: false,
  isEscalating: false,
  isPending: false,
};

function makeStats(overrides: Partial<ClusterStats>): ClusterStats {
  return {...defaultStats, ...overrides};
}

describe('getSortedClusterIds', () => {
  it('downranks event volume when users are zero', () => {
    const clusters: ClusterSortInput[] = [
      {clusterId: 1, assignedTo: [], fixabilityScore: 0.6, issueCount: 5},
      {clusterId: 2, assignedTo: [], fixabilityScore: 0.6, issueCount: 5},
    ];
    const clusterStatsById = new Map<number, ClusterStats>([
      [1, makeStats({totalEvents: 1_000_000, totalUsers: 0})],
      [2, makeStats({totalEvents: 1_000, totalUsers: 100})],
    ]);

    const sorted = getSortedClusterIds({
      clusters,
      clusterStatsById,
      userId: 'user-1',
      userTeamIds: new Set(),
    });

    expect(sorted[0]).toBe(2);
  });

  it('prefers higher fixability when urgency is similar', () => {
    const clusters: ClusterSortInput[] = [
      {clusterId: 1, assignedTo: [], fixabilityScore: 0.1, issueCount: 5},
      {clusterId: 2, assignedTo: [], fixabilityScore: 0.9, issueCount: 5},
    ];
    const clusterStatsById = new Map<number, ClusterStats>([
      [1, makeStats({totalEvents: 500, totalUsers: 50})],
      [2, makeStats({totalEvents: 500, totalUsers: 50})],
    ]);

    const sorted = getSortedClusterIds({
      clusters,
      clusterStatsById,
      userId: 'user-1',
      userTeamIds: new Set(),
    });

    expect(sorted[0]).toBe(2);
  });

  it('downranks single-issue clusters', () => {
    const clusters: ClusterSortInput[] = [
      {clusterId: 1, assignedTo: [], fixabilityScore: 0.7, issueCount: 1},
      {clusterId: 2, assignedTo: [], fixabilityScore: 0.7, issueCount: 5},
    ];
    const clusterStatsById = new Map<number, ClusterStats>([
      [1, makeStats({totalEvents: 200, totalUsers: 40})],
      [2, makeStats({totalEvents: 200, totalUsers: 40})],
    ]);

    const sorted = getSortedClusterIds({
      clusters,
      clusterStatsById,
      userId: 'user-1',
      userTeamIds: new Set(),
    });

    expect(sorted[0]).toBe(2);
  });
});
