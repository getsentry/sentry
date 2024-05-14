import getDuration from 'sentry/utils/duration/getDuration';

export function getPerformanceDuration(milliseconds: number) {
  return getDuration(milliseconds / 1000, milliseconds > 1000 ? 2 : 0, true);
}
