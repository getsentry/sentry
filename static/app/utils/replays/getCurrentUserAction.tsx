import {relativeTimeInMs} from 'sentry/components/replays/utils';
import {Crumb} from 'sentry/types/breadcrumbs';

export function getCurrentUserAction(
  userActionCrumbs: Crumb[] | undefined,
  startTimestamp: number | undefined,
  currentHoverTime?: number | undefined
) {
  if (!startTimestamp || !userActionCrumbs || currentHoverTime === undefined) {
    return undefined;
  }

  return userActionCrumbs.reduce((prev, curr) => {
    return Math.abs(
      relativeTimeInMs(curr.timestamp ?? '', startTimestamp) - currentHoverTime
    ) <
      Math.abs(relativeTimeInMs(prev.timestamp ?? '', startTimestamp) - currentHoverTime)
      ? curr
      : prev;
  });
}
