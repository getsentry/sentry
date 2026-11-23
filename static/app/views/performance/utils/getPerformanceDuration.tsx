import {getDuration} from '@sentry/scraps/duration';

export function getPerformanceDuration(milliseconds: number) {
  return getDuration(milliseconds / 1000, {
    precision: milliseconds > 1000 ? 2 : 0,
    style: 'short',
  });
}
