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
    // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
    combinedStats[status] = (statsA[status] ?? 0) + (statsB[status] ?? 0);
  }
  return combinedStats;
}
