import type {TimeseriesValue} from 'sentry/types/core';
import type {Group} from 'sentry/types/group';

export interface AggregatedSupergroupStats {
  eventCount: number;
  filteredEventCount: number | null;
  filteredUserCount: number | null;
  firstSeen: string | null;
  lastSeen: string | null;
  mergedFilteredStats: TimeseriesValue[] | null;
  mergedStats: TimeseriesValue[];
  userCount: number;
}

function addTimeseries(
  acc: TimeseriesValue[] | null,
  series: TimeseriesValue[]
): TimeseriesValue[] {
  if (acc === null) {
    return series.map(([ts, val]) => [ts, val] as TimeseriesValue);
  }
  for (let i = 0; i < Math.min(acc.length, series.length); i++) {
    acc[i] = [acc[i]![0], acc[i]![1] + series[i]![1]];
  }
  return acc;
}

/**
 * Aggregate stats from member groups for display in a supergroup row.
 * Sums event/user counts, takes min firstSeen and max lastSeen,
 * and point-wise sums the trend data.
 *
 * When groups have filtered stats (from search filters), those are
 * aggregated separately so the supergroup row can show total vs matching.
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
  let filteredEventCount: number | null = null;
  let filteredUserCount: number | null = null;
  let firstSeen: string | null = null;
  let lastSeen: string | null = null;
  let mergedStats: TimeseriesValue[] | null = null;
  let mergedFilteredStats: TimeseriesValue[] | null = null;

  for (const group of groups) {
    eventCount += parseInt(group.count, 10);
    userCount += group.userCount;

    if (group.filtered) {
      filteredEventCount ??= 0;
      filteredUserCount ??= 0;
      filteredEventCount += parseInt(group.filtered.count, 10);
      filteredUserCount += group.filtered.userCount;

      const filteredStats = group.filtered.stats?.[statsPeriod];
      if (filteredStats) {
        mergedFilteredStats = addTimeseries(mergedFilteredStats, filteredStats);
      }
    }

    const gFirstSeen = group.lifetime?.firstSeen ?? group.firstSeen;
    if (!firstSeen || gFirstSeen < firstSeen) {
      firstSeen = gFirstSeen;
    }

    const gLastSeen = group.lifetime?.lastSeen ?? group.lastSeen;
    if (!lastSeen || gLastSeen > lastSeen) {
      lastSeen = gLastSeen;
    }

    const stats = group.stats?.[statsPeriod];
    if (stats) {
      mergedStats = addTimeseries(mergedStats, stats);
    }
  }

  return {
    eventCount,
    userCount,
    filteredEventCount,
    filteredUserCount,
    firstSeen,
    lastSeen,
    mergedStats: mergedStats ?? [],
    mergedFilteredStats,
  };
}
