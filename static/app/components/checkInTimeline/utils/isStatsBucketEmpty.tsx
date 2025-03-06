import type {StatsBucket} from '../types';

export function isStatsBucketEmpty<Status extends string>(
  stats: StatsBucket<Status>
): boolean {
  return Object.values(stats).every(value => value === 0);
}
