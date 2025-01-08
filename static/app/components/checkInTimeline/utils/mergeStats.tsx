import type {StatsBucket} from '../types';

/**
 * Combines job status counts
 */
export function mergeStats<Status extends string>(
  statusPrecedent: string[],
  statsA: StatsBucket<Status>,
  statsB: StatsBucket<Status>
): StatsBucket<Status> {
  const combinedStats = {} as StatsBucket<Status>;
  for (const status of statusPrecedent) {
    combinedStats[status] = (statsA[status] ?? 0) + (statsB[status] ?? 0);
  }
  return combinedStats;
}
