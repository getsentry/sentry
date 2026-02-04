import {
  PENDING_CLUSTER_STATS,
  type ClusterStats,
} from 'sentry/views/issueList/dynamicGrouping/clusterStats';

const MAX_NEW_ISSUES_FOR_SCORE = 10;
// Prevent low fixability from zeroing urgency; higher = more weight to fixability.
const FIXABILITY_FLOOR = 0.2;
// Single-issue clusters are less actionable; penalize their priority.
const SINGLE_ISSUE_WEIGHT = 0.75;
// Multiplies volume impact (events/users) after percentile normalization.
const VOLUME_WEIGHT = 260;

interface AssignedEntity {
  id: string;
  type: string;
}

export interface ClusterSortInput {
  clusterId: number;
  fixabilityScore: number | null;
  issueCount: number;
  assignedTo?: AssignedEntity[];
}

interface SortClustersParams {
  clusterStatsById: Map<number, ClusterStats>;
  clusters: ClusterSortInput[];
  userId: string;
  userTeamIds: Set<string>;
}

interface ScorePercentiles {
  events: Map<number, number>;
  fixability: Map<number, number>;
  users: Map<number, number>;
}

interface SortEntry {
  clusterId: number;
  fixabilityPercent: number;
  index: number;
  priority: number;
  scope: number;
  tier: number;
}

function getAssignmentTier(
  cluster: ClusterSortInput,
  userId: string,
  userTeamIds: Set<string>
): number {
  let hasAssignment = false;
  for (const entity of cluster.assignedTo ?? []) {
    hasAssignment = true;
    if (entity.type === 'user' && entity.id === userId) {
      return 3;
    }
    if (entity.type === 'team' && userTeamIds.has(entity.id)) {
      return 2;
    }
  }

  return hasAssignment ? 1 : 0;
}

// Precompute rank percentiles so volume/fixability are comparable across the current set.
function buildPercentileMap(values: number[]): Map<number, number> {
  if (values.length === 0) {
    return new Map();
  }

  const sorted = values.toSorted((a, b) => a - b);
  const total = sorted.length;
  const percentileMap = new Map<number, number>();

  let start = 0;
  while (start < sorted.length) {
    const value = sorted[start] ?? 0;
    let end = start;
    while (end + 1 < sorted.length && sorted[end + 1] === value) {
      end += 1;
    }
    const averageIndex = (start + end) / 2;
    const percentile = (averageIndex + 1) / (total + 1);
    percentileMap.set(value, percentile);
    start = end + 1;
  }

  return percentileMap;
}

function getPercentile(value: number, percentileMap: Map<number, number>): number {
  return percentileMap.get(value) ?? 0.5;
}

function getScorePercentiles(
  clusters: ClusterSortInput[],
  clusterStatsById: Map<number, ClusterStats>
): ScorePercentiles {
  const eventValues: number[] = [];
  const userValues: number[] = [];
  const fixabilityValues: number[] = [];

  for (const cluster of clusters) {
    const stats = clusterStatsById.get(cluster.clusterId) ?? PENDING_CLUSTER_STATS;
    if (!stats.isPending) {
      eventValues.push(Math.log1p(stats.totalEvents));
      userValues.push(Math.log1p(stats.totalUsers));
    }
    fixabilityValues.push(cluster.fixabilityScore ?? 0);
  }

  return {
    events: buildPercentileMap(eventValues),
    fixability: buildPercentileMap(fixabilityValues),
    users: buildPercentileMap(userValues),
  };
}

// Urgency captures regressions/escalations plus recency/new issues.
function getBaseUrgencyScore(clusterStats: ClusterStats): number {
  if (clusterStats.isPending) {
    return 0;
  }

  let score = 0;
  if (clusterStats.hasRegressedIssues) {
    score += 400;
  }
  if (clusterStats.isEscalating) {
    score += 300;
  }

  score += Math.min(clusterStats.newIssuesCount, MAX_NEW_ISSUES_FOR_SCORE) * 20;

  if (clusterStats.lastSeen) {
    const now = Date.now();
    const lastSeenMs = new Date(clusterStats.lastSeen).getTime();
    const hoursSinceLastSeen = (now - lastSeenMs) / 3_600_000;
    if (hoursSinceLastSeen <= 24) {
      score += 120;
    } else if (hoursSinceLastSeen <= 72) {
      score += 60;
    } else if (hoursSinceLastSeen <= 168) {
      score += 20;
    }
  }

  return score;
}

function getFixabilityPercent(
  cluster: ClusterSortInput,
  percentiles: ScorePercentiles
): number {
  const fixabilityRaw = cluster.fixabilityScore ?? 0;
  if (percentiles.fixability.size === 0) {
    return fixabilityRaw;
  }
  const fixabilityNormalized = getPercentile(fixabilityRaw, percentiles.fixability);
  return (fixabilityRaw + fixabilityNormalized) / 2;
}

function getVolumeScore(
  clusterStats: ClusterStats,
  percentiles: ScorePercentiles
): number {
  if (clusterStats.isPending) {
    return 0;
  }

  if (clusterStats.totalUsers <= 0) {
    return 0;
  }

  const eventsPercent = getPercentile(
    Math.log1p(clusterStats.totalEvents),
    percentiles.events
  );
  const usersPercent = getPercentile(
    Math.log1p(clusterStats.totalUsers),
    percentiles.users
  );

  return eventsPercent * usersPercent * VOLUME_WEIGHT;
}

function getScopeScore(cluster: ClusterSortInput): number {
  return Math.min(cluster.issueCount, 10) * 5;
}

function getScopeWeight(cluster: ClusterSortInput): number {
  if (cluster.issueCount <= 1) {
    return SINGLE_ISSUE_WEIGHT;
  }
  return 1;
}

// Priority is the main sort signal after assignment tier.
function getPriorityScore(
  cluster: ClusterSortInput,
  clusterStats: ClusterStats,
  percentiles: ScorePercentiles,
  fixabilityPercent: number
): number {
  const baseUrgency = getBaseUrgencyScore(clusterStats);
  const volumeScore = getVolumeScore(clusterStats, percentiles);
  const fixabilityWeight = FIXABILITY_FLOOR + (1 - FIXABILITY_FLOOR) * fixabilityPercent;
  const scopeWeight = getScopeWeight(cluster);

  return (baseUrgency + volumeScore) * fixabilityWeight * scopeWeight;
}

export function getSortedClusterIds({
  clusterStatsById,
  clusters,
  userId,
  userTeamIds,
}: SortClustersParams): number[] {
  if (clusters.length <= 1) {
    return clusters.map(cluster => cluster.clusterId);
  }

  const percentiles = getScorePercentiles(clusters, clusterStatsById);
  const entries: SortEntry[] = clusters.map((cluster, index) => {
    const stats = clusterStatsById.get(cluster.clusterId) ?? PENDING_CLUSTER_STATS;
    const tier = getAssignmentTier(cluster, userId, userTeamIds);
    const fixabilityPercent = getFixabilityPercent(cluster, percentiles);
    const priority = getPriorityScore(cluster, stats, percentiles, fixabilityPercent);

    return {
      clusterId: cluster.clusterId,
      fixabilityPercent,
      index,
      priority,
      scope: getScopeScore(cluster),
      tier,
    };
  });

  const sortedEntries = entries.sort((a, b) => {
    if (a.tier !== b.tier) {
      return b.tier - a.tier;
    }
    if (a.priority !== b.priority) {
      return b.priority - a.priority;
    }
    if (a.fixabilityPercent !== b.fixabilityPercent) {
      return b.fixabilityPercent - a.fixabilityPercent;
    }
    if (a.scope !== b.scope) {
      return b.scope - a.scope;
    }
    return a.index - b.index;
  });

  return sortedEntries.map(entry => entry.clusterId);
}
