import {relativeTimeInMs} from 'sentry/components/replays/utils';
import {Crumb} from 'sentry/types/breadcrumbs';

export function getCurrentUserAction(
  userActionCrumbs: Crumb[] | undefined,
  startTimestamp: number | undefined,
  currentHoverTime: number | undefined
) {
  if (
    !startTimestamp ||
    !userActionCrumbs ||
    userActionCrumbs.length < 1 ||
    currentHoverTime === undefined
  ) {
    return undefined;
  }

  return userActionCrumbs.reduce((prev, curr) => {
    return currentHoverTime >= relativeTimeInMs(curr.timestamp ?? '', startTimestamp)
      ? curr
      : prev;
  });
}
