import type {StatsBucket} from '../types';

/**
 * Combines job status counts
 */
export function mergeStats<Status extends string>(
  statusPrecedent: Status[],
  ...stats: Array<StatsBucket<Status>>
): StatsBucket<Status> {
  const combinedStats = {} as StatsBucket<Status>;
  for (const status of statusPrecedent) {
    combinedStats[status] = stats.reduce<number>(
      (curr, next) => curr + (next[status] ?? 0),
      0
    );
  }
  return combinedStats;
}
