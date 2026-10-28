import type {GroupOpenPeriod} from 'sentry/types/group';

const MILLISECONDS_PER_SECOND = 1000;

export function getOpenPeriodDurationSeconds(
  openPeriod: Pick<GroupOpenPeriod, 'start' | 'end'>,
  now: Date
): number {
  const openPeriodEnd = openPeriod.end ? new Date(openPeriod.end) : now;

  const openPeriodEndMilliseconds = openPeriodEnd.getTime();

  const openPeriodStartMilliseconds = new Date(openPeriod.start).getTime();

  const openPeriodDurationMilliseconds =
    openPeriodEndMilliseconds - openPeriodStartMilliseconds;

  return openPeriodDurationMilliseconds / MILLISECONDS_PER_SECOND;
}
