import type {TimeseriesValue} from 'sentry/types/core';
import type {Group} from 'sentry/types/group';

export interface AggregatedSupergroupStats {
  eventCount: number;
  firstSeen: string | null;
  lastSeen: string | null;
  mergedStats: TimeseriesValue[];
  userCount: number;
}

/**
 * Aggregate stats from member groups for display in a supergroup row.
 * Sums event/user counts, takes min firstSeen and max lastSeen,
 * and point-wise sums the trend data.
 */
export function aggregateSupergroupStats(
  groups: Group[],
  statsPeriod: string
): AggregatedSupergroupStats | null {
  if (groups.length === 0) {
    return null;
  }

  let eventCount = 0;
  let userCount = 0;
  let firstSeen: string | null = null;
  let lastSeen: string | null = null;
  let mergedStats: TimeseriesValue[] = [];

  for (const group of groups) {
    eventCount += parseInt(group.count, 10) || 0;
    userCount += group.userCount || 0;

    const gFirstSeen = group.lifetime?.firstSeen ?? group.firstSeen;
    if (gFirstSeen && (!firstSeen || gFirstSeen < firstSeen)) {
      firstSeen = gFirstSeen;
    }

    const gLastSeen = group.lifetime?.lastSeen ?? group.lastSeen;
    if (gLastSeen && (!lastSeen || gLastSeen > lastSeen)) {
      lastSeen = gLastSeen;
    }

    const stats = group.stats?.[statsPeriod];
    if (stats) {
      if (mergedStats.length === 0) {
        mergedStats = stats.map(([ts, val]) => [ts, val] as TimeseriesValue);
      } else {
        for (let i = 0; i < Math.min(mergedStats.length, stats.length); i++) {
          mergedStats[i] = [mergedStats[i]![0], mergedStats[i]![1] + stats[i]![1]];
        }
      }
    }
  }

  return {eventCount, userCount, firstSeen, lastSeen, mergedStats};
}
