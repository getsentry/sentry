import {relativeTimeInMs} from 'sentry/components/replays/utils';
import {Crumb} from 'sentry/types/breadcrumbs';

export function getCurrentUserAction(
  userActionCrumbs: Crumb[],
  startTimestamp: number,
  currentHoverTime: number
) {
  return userActionCrumbs.reduce((prev, curr) => {
    return Math.abs(
      relativeTimeInMs(curr.timestamp ?? '', startTimestamp) - currentHoverTime
    ) <
      Math.abs(relativeTimeInMs(prev.timestamp ?? '', startTimestamp) - currentHoverTime)
      ? curr
      : prev;
  });
}
