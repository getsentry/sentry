import type {StatsBucket} from 'sentry/components/checkInTimeline/types';

export function isStatsBucketEmpty<Status extends string>(
  stats: StatsBucket<Status>
): boolean {
  return Object.values(stats).every(value => value === 0);
}
