import type {StatsBucket} from 'sentry/components/checkInTimeline/types';

/**
 * Combines job status counts
 */
export function mergeStats<Status extends string>(
  statusPrecedent: Status[],
  ...stats: Array<StatsBucket<Status>>
): StatsBucket<Status> {
  const combinedStats = {} as StatsBucket<Status>;
  for (const status of statusPrecedent) {
    // Will be fixed by https://github.com/typescript-eslint/typescript-eslint/pull/12206
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-arguments
    combinedStats[status] = stats.reduce<number>(
      (curr, next) => curr + (next[status] ?? 0),
      0
    );
  }
  return combinedStats;
}
